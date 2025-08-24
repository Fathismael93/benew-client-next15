// app/blog/page.jsx
// Server Component optimisé pour la liste des articles de blog
// Next.js 15 + PostgreSQL + Monitoring complet + Gestion d'erreurs avancée

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import ListBlog from '@/components/blog/ListBlog';
import { getClient } from '@/backend/dbConnect';
import { captureException, captureMessage } from '../../instrumentation';
import Loading from './loading';

// Configuration étendue avec gestion d'erreurs avancée
const CONFIG = {
  cache: {
    revalidate: 180, // 3 minutes ISR pour blog (plus dynamique)
    errorRevalidate: 30, // 30 secondes pour erreurs temporaires
  },
  performance: {
    slowQueryThreshold: 1000, // Blog = plus sensible aux performances
    queryTimeout: 4000, // 4 secondes timeout pour blog
  },
  retry: {
    maxAttempts: 2,
    baseDelay: 100,
  },
};

// Types d'erreurs standardisés
const ERROR_TYPES = {
  DATABASE_ERROR: 'database_error',
  TIMEOUT: 'timeout',
  CONNECTION_ERROR: 'connection_error',
  PERMISSION_ERROR: 'permission_error',
  IMAGE_LOADING_ERROR: 'image_loading_error',
  NETWORK_ERROR: 'network_error',
  CONTENT_ERROR: 'content_error',
  UNKNOWN_ERROR: 'unknown_error',
};

// Codes d'erreur PostgreSQL
const PG_ERROR_CODES = {
  CONNECTION_FAILURE: '08001',
  CONNECTION_EXCEPTION: '08000',
  QUERY_CANCELED: '57014',
  ADMIN_SHUTDOWN: '57P01',
  CRASH_SHUTDOWN: '57P02',
  CANNOT_CONNECT: '57P03',
  DATABASE_DROPPED: '57P04',
  UNDEFINED_TABLE: '42P01',
  INSUFFICIENT_PRIVILEGE: '42501',
  AUTHENTICATION_FAILED: '28000',
  INVALID_PASSWORD: '28P01',
};

/**
 * Classifie les erreurs PostgreSQL et autres erreurs système
 */
function classifyError(error) {
  if (!error) {
    return {
      type: ERROR_TYPES.UNKNOWN_ERROR,
      shouldRetry: false,
      httpStatus: 500,
    };
  }

  const code = error.code;
  const message = error.message?.toLowerCase() || '';

  // Erreurs de connexion (temporaires)
  if (
    [
      PG_ERROR_CODES.CONNECTION_FAILURE,
      PG_ERROR_CODES.CONNECTION_EXCEPTION,
      PG_ERROR_CODES.CANNOT_CONNECT,
      PG_ERROR_CODES.ADMIN_SHUTDOWN,
      PG_ERROR_CODES.CRASH_SHUTDOWN,
    ].includes(code)
  ) {
    return {
      type: ERROR_TYPES.CONNECTION_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage:
        'Service temporairement indisponible. Veuillez réessayer dans quelques instants.',
    };
  }

  // Timeout de requête
  if (code === PG_ERROR_CODES.QUERY_CANCELED || message.includes('timeout')) {
    return {
      type: ERROR_TYPES.TIMEOUT,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: 'Le chargement a pris trop de temps. Veuillez réessayer.',
    };
  }

  // Erreurs de permissions
  if (
    [
      PG_ERROR_CODES.INSUFFICIENT_PRIVILEGE,
      PG_ERROR_CODES.AUTHENTICATION_FAILED,
      PG_ERROR_CODES.INVALID_PASSWORD,
    ].includes(code)
  ) {
    return {
      type: ERROR_TYPES.PERMISSION_ERROR,
      shouldRetry: false,
      httpStatus: 500,
      userMessage: 'Erreur de configuration serveur.',
    };
  }

  // Erreurs de configuration (table inexistante, etc.)
  if (code === PG_ERROR_CODES.UNDEFINED_TABLE) {
    return {
      type: ERROR_TYPES.DATABASE_ERROR,
      shouldRetry: false,
      httpStatus: 500,
      userMessage: 'Erreur de configuration serveur.',
    };
  }

  // Erreurs réseau
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connexion')
  ) {
    return {
      type: ERROR_TYPES.NETWORK_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage:
        'Problème de connexion réseau. Vérifiez votre connexion internet.',
    };
  }

  // Erreurs d'images (spécifique blog avec Cloudinary)
  if (message.includes('cloudinary') || message.includes('image')) {
    return {
      type: ERROR_TYPES.IMAGE_LOADING_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: 'Problème de chargement des images des articles.',
    };
  }

  // Erreurs de contenu (spécifique blog)
  if (
    message.includes('article') ||
    message.includes('content') ||
    message.includes('post')
  ) {
    return {
      type: ERROR_TYPES.CONTENT_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: 'Problème de chargement du contenu des articles.',
    };
  }

  // Timeout général (pas PostgreSQL)
  if (message.includes('timeout') || error.name === 'TimeoutError') {
    return {
      type: ERROR_TYPES.TIMEOUT,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: 'Le chargement a pris trop de temps. Veuillez réessayer.',
    };
  }

  // Erreur de base de données générique
  return {
    type: ERROR_TYPES.DATABASE_ERROR,
    shouldRetry: false,
    httpStatus: 500,
    userMessage:
      'Une erreur inattendue est survenue lors du chargement des articles.',
  };
}

/**
 * Promise avec timeout
 */
function withTimeout(promise, timeoutMs, errorMessage = 'Operation timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        const timeoutError = new Error(errorMessage);
        timeoutError.name = 'TimeoutError';
        reject(timeoutError);
      }, timeoutMs);
    }),
  ]);
}

/**
 * Exécute une requête avec retry logic
 */
async function executeWithRetry(
  operation,
  maxAttempts = CONFIG.retry.maxAttempts,
) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const errorInfo = classifyError(error);

      // Ne pas retry si c'est pas une erreur temporaire
      if (!errorInfo.shouldRetry || attempt === maxAttempts) {
        throw error;
      }

      // Délai exponentiel pour retry
      const delay = CONFIG.retry.baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));

      captureMessage(
        `Retrying blog data fetch (attempt ${attempt}/${maxAttempts})`,
        {
          level: 'info',
          tags: { component: 'blog_page', retry: true },
          extra: {
            attempt,
            maxAttempts,
            errorType: errorInfo.type,
            delay,
          },
        },
      );
    }
  }

  throw lastError;
}

/**
 * Fonction principale avec gestion d'erreurs avancée et retry
 */
async function getBlogArticles() {
  const startTime = performance.now();

  try {
    return await executeWithRetry(async () => {
      const client = await getClient();

      try {
        // Query avec timeout intégré et optimisations image
        const queryPromise = client.query(`
          SELECT 
            article_id, 
            article_title, 
            article_image, 
            TO_CHAR(article_created, 'DD/MM/YYYY') as created,
            (SELECT COUNT(*) FROM admin.articles WHERE is_active = true) as total_articles
          FROM admin.articles 
          WHERE is_active = true 
          ORDER BY article_created DESC, article_id DESC
        `);

        const result = await withTimeout(
          queryPromise,
          CONFIG.performance.queryTimeout,
          'Database query timeout',
        );

        const queryDuration = performance.now() - startTime;

        console.log('Blog articles fetched:');
        console.log(result);
        // Log performance avec monitoring complet
        if (queryDuration > CONFIG.performance.slowQueryThreshold) {
          captureMessage('Slow blog query detected', {
            level: 'warning',
            tags: {
              component: 'blog_page',
              performance: true,
            },
            extra: {
              duration: queryDuration,
              articlesCount: result.rows.length,
              queryTimeout: CONFIG.performance.queryTimeout,
            },
          });
        }

        // Log de succès en dev
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[Blog] Query exécutée en ${Math.round(queryDuration)}ms (timeout: ${CONFIG.performance.queryTimeout}ms)`,
          );
        }

        // Enrichissement des articles avec optimisations
        const enrichedArticles = result.rows.map((article) => ({
          ...article,
          canonical_url: `/blog/${article.article_id}`,
          optimized_image: article.article_image?.includes('cloudinary.com')
            ? article.article_image.replace(
                '/upload/',
                '/upload/w_400,h_300,c_fill,q_auto:low,f_auto/',
              )
            : article.article_image,
          reading_time: Math.max(1, Math.ceil(article.excerpt.length / 200)), // Estimation temps de lecture
        }));

        // Succès
        return {
          articles: enrichedArticles,
          success: true,
          queryDuration,
          totalArticles: result.rows[0]?.total_articles || 0,
        };
      } finally {
        client.release();
      }
    });
  } catch (error) {
    const errorInfo = classifyError(error);
    const queryDuration = performance.now() - startTime;

    // Log détaillé pour monitoring avec tous les contextes
    captureException(error, {
      tags: {
        component: 'blog_page',
        error_type: errorInfo.type,
        should_retry: errorInfo.shouldRetry.toString(),
        http_status: errorInfo.httpStatus.toString(),
      },
      extra: {
        queryDuration,
        pgErrorCode: error.code,
        errorMessage: error.message,
        timeout: CONFIG.performance.queryTimeout,
      },
    });

    return {
      articles: [],
      success: false,
      errorType: errorInfo.type,
      httpStatus: errorInfo.httpStatus,
      userMessage: errorInfo.userMessage,
      shouldRetry: errorInfo.shouldRetry,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    };
  }
}

/**
 * Composant d'erreur réutilisable avec design cohérent
 */
function BlogError({ errorType, userMessage, shouldRetry }) {
  return (
    <div className="blog-error-page">
      <section className="first">
        <div className="error-content">
          <div className="server-error">
            <div className="error-icon">
              {errorType === ERROR_TYPES.TIMEOUT
                ? '⏱️'
                : errorType === ERROR_TYPES.IMAGE_LOADING_ERROR
                  ? '🖼️'
                  : errorType === ERROR_TYPES.CONTENT_ERROR
                    ? '📄'
                    : errorType === ERROR_TYPES.NETWORK_ERROR
                      ? '🌐'
                      : '⚠️'}
            </div>
            <h1 className="error-code">
              {errorType === ERROR_TYPES.TIMEOUT ? '503' : '500'}
            </h1>
            <h2 className="error-title">
              {shouldRetry
                ? 'Blog temporairement indisponible'
                : 'Erreur technique'}
            </h2>
            <p className="error-message">{userMessage}</p>
            <div className="error-actions">
              {shouldRetry && (
                <button className="cta-button primary">🔄 Réessayer</button>
              )}
              <Link href="/" className="cta-button secondary">
                🏠 Retour à l&apos;accueil
              </Link>
            </div>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="debug-section">
              <details className="debug-details">
                <summary className="debug-summary">
                  Informations de débogage
                </summary>
                <div className="debug-content">
                  <p>
                    <strong>Type d&apos;erreur:</strong> {errorType}
                  </p>
                  <p>
                    <strong>Peut réessayer:</strong>{' '}
                    {shouldRetry ? 'Oui' : 'Non'}
                  </p>
                  <p>
                    <strong>Page:</strong> blog (liste articles)
                  </p>
                </div>
              </details>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Composant principal avec gestion d'erreurs différenciée
 */
export default async function BlogPage() {
  // Récupérer les données avec gestion d'erreurs avancée
  const data = await getBlogArticles();

  // Gestion différenciée des erreurs
  if (!data.success) {
    // En production, on peut choisir de montrer une page d'erreur custom
    // plutôt que notFound() pour certains types d'erreurs temporaires
    if (data.shouldRetry && process.env.NODE_ENV === 'production') {
      return (
        <BlogError
          errorType={data.errorType}
          userMessage={data.userMessage}
          shouldRetry={data.shouldRetry}
        />
      );
    }

    // Pour les erreurs non récupérables en production
    if (process.env.NODE_ENV === 'production') {
      notFound();
    }

    // En dev, affichage détaillé
    return (
      <BlogError
        errorType={data.errorType}
        userMessage={data.userMessage}
        shouldRetry={data.shouldRetry}
      />
    );
  }

  // Cas spécial : pas d'articles (valide pour un blog en démarrage)
  if (!data.articles || data.articles.length === 0) {
    return (
      <div className="blog-empty-state">
        <section className="first">
          <div className="empty-content">
            <div className="empty-card">
              <div className="empty-icon">📝</div>
              <h1 className="empty-title">Aucun article disponible</h1>
              <p className="empty-message">
                Nos articles sont en cours de rédaction.
              </p>
              <p className="empty-submessage">
                Revenez bientôt pour découvrir nos derniers articles et
                actualités.
              </p>
              <div className="empty-actions">
                <Link href="/" className="cta-button primary">
                  🏠 Retour à l&apos;accueil
                </Link>
                <Link href="/templates" className="cta-button secondary">
                  📋 Voir nos templates
                </Link>
                <Link href="/contact" className="cta-button outline">
                  📞 Nous contacter
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Rendu normal avec Suspense - Error Boundary géré par error.jsx
  return (
    <Suspense fallback={<Loading />}>
      <ListBlog posts={data.articles} totalArticles={data.totalArticles} />
    </Suspense>
  );
}

// Metadata pour SEO blog avec gestion d'erreurs
export const metadata = {
  title: 'Blog Benew - Articles et Actualités',
  description:
    'Découvrez nos derniers articles sur le développement web, les templates et les applications mobiles.',
  keywords: [
    'blog développement web',
    'articles techniques',
    'actualités tech',
    'templates web',
    'applications mobiles',
    'Benew',
    'Djibouti',
  ],
  openGraph: {
    title: 'Blog Benew - Articles et Actualités',
    description: 'Articles et actualités sur le développement web et mobile',
    type: 'website',
    locale: 'fr_FR',
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/blog`,
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/blog`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Configuration ISR Next.js 15
export const revalidate = 180; // 3 minutes pour blog (plus dynamique)

// Force static pour performance optimale
export const dynamic = 'force-static';
