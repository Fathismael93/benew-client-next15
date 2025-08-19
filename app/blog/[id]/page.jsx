/* eslint-disable no-unused-vars */
// app/blog/[id]/page.jsx
// Server Component optimisé pour un article de blog spécifique
// Next.js 15 + PostgreSQL + Monitoring complet + Gestion d'erreurs avancée + Query Timeout

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import SinglePost from '@/components/blog/SinglePost';
import { getClient } from '@/backend/dbConnect';
import { captureException, captureMessage } from '../../../instrumentation';
import Loading from './loading';

// Configuration étendue avec gestion d'erreurs avancée
const CONFIG = {
  cache: {
    revalidate: 180, // 3 minutes pour blog
    errorRevalidate: 60, // 1 minute pour erreurs temporaires
  },
  performance: {
    slowQueryThreshold: 1000, // Blog = expérience lecture sensible
    queryTimeout: 8000, // 8 secondes timeout (article + related)
  },
  retry: {
    maxAttempts: 2,
    baseDelay: 200, // Plus rapide pour blog
  },
};

// Types d'erreurs standardisés
const ERROR_TYPES = {
  DATABASE_ERROR: 'database_error',
  TIMEOUT: 'timeout',
  CONNECTION_ERROR: 'connection_error',
  PERMISSION_ERROR: 'permission_error',
  ARTICLE_NOT_FOUND: 'article_not_found',
  INVALID_ID: 'invalid_id',
  IMAGE_LOADING_ERROR: 'image_loading_error',
  NETWORK_ERROR: 'network_error',
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
 * Validation avancée de l'ID d'article
 */
function validateArticleId(articleId) {
  if (!articleId || typeof articleId !== 'string') {
    return {
      isValid: false,
      errorType: ERROR_TYPES.INVALID_ID,
      userMessage: "L'identifiant de l'article est manquant ou invalide.",
    };
  }

  // Vérifications supplémentaires pour sécurité
  if (articleId.length === 0 || articleId.length > 50) {
    return {
      isValid: false,
      errorType: ERROR_TYPES.INVALID_ID,
      userMessage:
        "L'identifiant de l'article n'est pas dans un format valide.",
    };
  }

  // Vérification de caractères suspects
  if (!/^[a-zA-Z0-9_-]+$/.test(articleId)) {
    return {
      isValid: false,
      errorType: ERROR_TYPES.INVALID_ID,
      userMessage:
        "L'identifiant de l'article contient des caractères non autorisés.",
    };
  }

  return { isValid: true, articleId };
}

/**
 * Classifie les erreurs PostgreSQL et autres erreurs système
 */
function classifyError(error, context = {}) {
  if (!error) {
    return {
      type: ERROR_TYPES.UNKNOWN_ERROR,
      shouldRetry: false,
      httpStatus: 500,
      userMessage: 'Une erreur inattendue est survenue.',
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
      userMessage:
        "Le chargement de l'article a pris trop de temps. Le serveur est peut-être surchargé.",
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

  // Erreurs d'images (Cloudinary)
  if (message.includes('cloudinary') || message.includes('image')) {
    return {
      type: ERROR_TYPES.IMAGE_LOADING_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: "Problème de chargement des images de l'article.",
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
      "Une erreur inattendue est survenue lors du chargement de l'article.",
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
  context = {},
) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const errorInfo = classifyError(error, context);

      // Ne pas retry si c'est pas une erreur temporaire
      if (!errorInfo.shouldRetry || attempt === maxAttempts) {
        throw error;
      }

      // Délai exponentiel pour retry
      const delay = CONFIG.retry.baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));

      captureMessage(
        `Retrying blog article fetch (attempt ${attempt}/${maxAttempts})`,
        {
          level: 'info',
          tags: {
            component: 'blog_article_page',
            retry: true,
            article_id: context.articleId,
          },
          extra: {
            attempt,
            maxAttempts,
            errorType: errorInfo.type,
            delay,
            articleId: context.articleId,
          },
        },
      );
    }
  }

  throw lastError;
}

/**
 * Enrichissement optimisé pour le blog
 */
function enrichArticleData(article) {
  if (!article) return null;

  const cleanText = article.article_text?.replace(/<[^>]*>/g, '') || '';

  return {
    ...article,
    canonical_url: `/blog/${article.article_id}`,
    // Optimisation Cloudinary pour blog
    optimized_image: article.article_image?.includes('cloudinary.com')
      ? article.article_image.replace(
          '/upload/',
          '/upload/w_800,h_600,c_fill,q_auto,f_auto/',
        )
      : article.article_image,
    // Métriques de lecture pour UX
    estimated_reading_time: Math.max(
      1,
      Math.ceil(cleanText.split(' ').length / 200),
    ),
    word_count: cleanText.split(' ').length,
    has_images: /<img\s+[^>]*src=/i.test(article.article_text || ''),
    // Données pour partage social
    excerpt:
      cleanText.length > 160
        ? cleanText.substring(0, 160) + '...'
        : cleanText ||
          `Lisez l'article "${article.article_title}" sur le blog Benew.`,
  };
}

/**
 * Fonction principale avec gestion d'erreurs avancée et retry
 */
async function getArticleData(articleId) {
  const startTime = performance.now();

  try {
    return await executeWithRetry(
      async () => {
        const client = await getClient();

        try {
          // Exécuter les requêtes en parallèle avec timeout intégré
          const queriesPromise = Promise.all([
            // 1. Article principal avec stats contextuelles
            client.query(
              `SELECT 
              article_id,
              article_title,
              article_text,
              article_image,
              TO_CHAR(article_created, 'DD/MM/YYYY') as created,
              article_created as created_raw,
              TO_CHAR(article_updated, 'DD/MM/YYYY') as updated,
              article_updated as updated_raw,
              (SELECT COUNT(*) FROM admin.articles WHERE is_active = true) as total_active_articles
            FROM admin.articles 
            WHERE article_id = $1 AND is_active = true`,
              [articleId],
            ),

            // 2. Articles similaires
            client.query(
              `SELECT 
              article_id,
              article_title,
              article_image,
              TO_CHAR(article_created, 'DD/MM/YYYY') as created
            FROM admin.articles 
            WHERE article_id != $1 AND is_active = true 
            ORDER BY article_created DESC 
            LIMIT 4`,
              [articleId],
            ),
          ]);

          const [articleResult, relatedResult] = await withTimeout(
            queriesPromise,
            CONFIG.performance.queryTimeout,
            'Blog article database queries timeout',
          );

          const queryDuration = performance.now() - startTime;

          // Log performance avec monitoring complet
          if (queryDuration > CONFIG.performance.slowQueryThreshold) {
            captureMessage('Slow blog article query detected', {
              level: 'warning',
              tags: {
                component: 'blog_article_page',
                performance: true,
                article_id: articleId,
              },
              extra: {
                duration: queryDuration,
                articleId,
                relatedCount: relatedResult.rows.length,
                queryTimeout: CONFIG.performance.queryTimeout,
                hasArticle: articleResult.rows.length > 0,
              },
            });
          }

          // Log de succès en dev
          if (process.env.NODE_ENV === 'development') {
            console.log(
              `[Blog Article] Query exécutée en ${Math.round(queryDuration)}ms (timeout: ${CONFIG.performance.queryTimeout}ms) - Article: ${articleId}`,
            );
          }

          // Vérifier si l'article existe
          if (articleResult.rows.length === 0) {
            return {
              article: null,
              relatedArticles: [],
              success: false,
              notFound: true,
              queryDuration,
            };
          }

          const rawArticle = articleResult.rows[0];
          const enrichedArticle = enrichArticleData(rawArticle);

          // Succès
          return {
            article: enrichedArticle,
            relatedArticles: relatedResult.rows,
            success: true,
            queryDuration,
          };
        } finally {
          client.release();
        }
      },
      CONFIG.retry.maxAttempts,
      { articleId },
    );
  } catch (error) {
    const errorInfo = classifyError(error, { articleId });
    const queryDuration = performance.now() - startTime;

    // Log détaillé pour monitoring avec tous les contextes
    captureException(error, {
      tags: {
        component: 'blog_article_page',
        error_type: errorInfo.type,
        should_retry: errorInfo.shouldRetry.toString(),
        http_status: errorInfo.httpStatus.toString(),
        article_id: articleId,
      },
      extra: {
        articleId,
        queryDuration,
        pgErrorCode: error.code,
        errorMessage: error.message,
        timeout: CONFIG.performance.queryTimeout,
      },
    });

    return {
      article: null,
      relatedArticles: [],
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
function BlogArticleError({ errorType, userMessage, shouldRetry, articleId }) {
  return (
    <div className="blog-article-error-page">
      <section className="first">
        <div className="error-content">
          <div className="server-error">
            <div className="error-icon">
              {errorType === ERROR_TYPES.TIMEOUT
                ? '⏱️'
                : errorType === ERROR_TYPES.IMAGE_LOADING_ERROR
                  ? '🖼️'
                  : errorType === ERROR_TYPES.NETWORK_ERROR
                    ? '🌐'
                    : errorType === ERROR_TYPES.ARTICLE_NOT_FOUND
                      ? '📄'
                      : '⚠️'}
            </div>
            <h1 className="error-code">
              {errorType === ERROR_TYPES.ARTICLE_NOT_FOUND
                ? '404'
                : errorType === ERROR_TYPES.TIMEOUT
                  ? '503'
                  : '500'}
            </h1>
            <h2 className="error-title">
              {errorType === ERROR_TYPES.ARTICLE_NOT_FOUND
                ? 'Article non trouvé'
                : shouldRetry
                  ? 'Service temporairement indisponible'
                  : 'Erreur technique'}
            </h2>
            <p className="error-message">{userMessage}</p>

            {articleId && (
              <div className="error-details">
                Article demandé : <strong>{articleId}</strong>
              </div>
            )}

            <div className="error-actions">
              {shouldRetry && (
                <button
                  onClick={() => window.location.reload()}
                  className="cta-button primary"
                >
                  🔄 Réessayer
                </button>
              )}
              <Link href="/blog" className="cta-button secondary">
                📋 Voir tous les articles
              </Link>
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
                    <strong>Article ID:</strong> {articleId || 'Non spécifié'}
                  </p>
                  <p>
                    <strong>Page:</strong> blog article (individual)
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
export default async function SingleBlogPage({ params }) {
  const { id: articleId } = await params;

  // Validation avancée
  const validation = validateArticleId(articleId);
  if (!validation.isValid) {
    // En production, on peut choisir de montrer une page d'erreur custom
    if (process.env.NODE_ENV === 'production') {
      return (
        <BlogArticleError
          errorType={validation.errorType}
          userMessage={validation.userMessage}
          shouldRetry={false}
          articleId={articleId}
        />
      );
    }
    // En dev, notFound standard
    notFound();
  }

  // Récupérer les données avec gestion d'erreurs avancée
  const data = await getArticleData(validation.articleId);

  // Gestion différenciée des erreurs
  if (!data.success) {
    // Article non trouvé - notFound() standard
    if (data.notFound) {
      notFound();
    }

    // En production, on peut choisir de montrer une page d'erreur custom
    // plutôt que notFound() pour certains types d'erreurs temporaires
    if (data.shouldRetry && process.env.NODE_ENV === 'production') {
      return (
        <BlogArticleError
          errorType={data.errorType}
          userMessage={data.userMessage}
          shouldRetry={data.shouldRetry}
          articleId={validation.articleId}
        />
      );
    }

    // Pour les erreurs non récupérables en production
    if (process.env.NODE_ENV === 'production') {
      notFound();
    }

    // En dev, affichage détaillé
    return (
      <BlogArticleError
        errorType={data.errorType}
        userMessage={data.userMessage}
        shouldRetry={data.shouldRetry}
        articleId={validation.articleId}
      />
    );
  }

  // Rendu normal avec Suspense - Error Boundary géré par error.jsx
  return (
    <Suspense fallback={<Loading />}>
      <SinglePost
        article={data.article}
        relatedArticles={data.relatedArticles}
        context={{
          articleId: validation.articleId,
          queryDuration: data.queryDuration,
        }}
      />
    </Suspense>
  );
}

/**
 * Génération des metadata avec gestion d'erreurs
 */
export async function generateMetadata({ params }) {
  const { id: articleId } = await params;

  // Validation basique
  const validation = validateArticleId(articleId);
  if (!validation.isValid) {
    return {
      title: 'Article non trouvé - Blog Benew',
      description: "L'article demandé n'existe pas ou n'est plus disponible.",
    };
  }

  try {
    // Requête simple pour metadata (pas de retry ici)
    const client = await getClient();
    try {
      const queryPromise = client.query(
        `SELECT 
          article_title,
          article_text,
          article_image,
          article_created,
          article_updated
        FROM admin.articles 
        WHERE article_id = $1 AND is_active = true`,
        [validation.articleId],
      );

      // Timeout court pour metadata
      const result = await withTimeout(
        queryPromise,
        3000,
        'Metadata query timeout',
      );

      if (result.rows.length > 0) {
        const article = result.rows[0];
        const cleanText = article.article_text?.replace(/<[^>]*>/g, '') || '';
        const description =
          cleanText.length > 160
            ? cleanText.substring(0, 160) + '...'
            : `Lisez l'article "${article.article_title}" sur le blog Benew.`;

        return {
          title: `${article.article_title} - Blog Benew`,
          description,
          keywords: [
            article.article_title,
            'blog Benew',
            'article',
            'Djibouti',
          ],
          robots: { index: true, follow: true },
          alternates: {
            canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/blog/${validation.articleId}`,
          },
          openGraph: {
            title: `${article.article_title} - Blog Benew`,
            description,
            images: article.article_image ? [article.article_image] : [],
            type: 'article',
            locale: 'fr_FR',
            publishedTime: article.created,
            modifiedTime: article.updated,
            url: `${process.env.NEXT_PUBLIC_SITE_URL}/blog/${validation.articleId}`,
          },
        };
      }
    } finally {
      client.release();
    }
  } catch (error) {
    // Log silencieux pour metadata (pas critique)
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[Blog Metadata] Failed for article ${validation.articleId}:`,
        error.message,
      );
    }
  }

  // Metadata par défaut
  return {
    title: 'Article - Blog Benew',
    description: 'Découvrez cet article sur le blog Benew.',
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/blog/${validation.articleId}`,
    },
  };
}

// Configuration ISR Next.js 15
export const revalidate = 180; // 3 minutes pour blog

// Force static pour performance optimale
export const dynamic = 'force-static';
