// app/templates/page.jsx
// Server Component optimisé pour liste des templates e-commerce
// Next.js 15 + PostgreSQL + Monitoring complet + Gestion d'erreurs avancée + Query Timeout

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import TemplatesList from '@/components/templates/TemplatesList';
import { getClient } from '@/backend/dbConnect';
import { captureException, captureMessage } from '../../instrumentation';
import Loading from './loading';

// Configuration étendue avec gestion d'erreurs avancée
const CONFIG = {
  cache: {
    revalidate: 300, // 5 minutes ISR pour succès
    errorRevalidate: 60, // 1 minute pour erreurs temporaires
  },
  performance: {
    slowQueryThreshold: 1500, // Alerte pour queries lentes
    queryTimeout: 5000, // 5 secondes timeout
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
      userMessage:
        'Le chargement a pris trop de temps. Le serveur est peut-être surchargé.',
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

  // Erreurs d'images
  if (message.includes('cloudinary') || message.includes('image')) {
    return {
      type: ERROR_TYPES.IMAGE_LOADING_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: 'Problème de chargement des images des templates.',
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
      'Une erreur inattendue est survenue lors du chargement des templates.',
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
        `Retrying templates data fetch (attempt ${attempt}/${maxAttempts})`,
        {
          level: 'info',
          tags: { component: 'templates_page', retry: true },
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
async function getTemplates() {
  const startTime = performance.now();

  try {
    return await executeWithRetry(async () => {
      const client = await getClient();

      try {
        // Query avec timeout intégré
        const queryPromise = client.query(`
          SELECT 
            template_id, 
            template_name, 
            template_image, 
            template_has_web, 
            template_has_mobile,
            (SELECT COUNT(*) FROM catalog.applications 
             WHERE application_template_id = t.template_id AND is_active = true) as applications_count
          FROM catalog.templates t
          WHERE is_active = true 
          ORDER BY template_added DESC
        `);

        const result = await withTimeout(
          queryPromise,
          CONFIG.performance.queryTimeout,
          'Database query timeout',
        );

        const queryDuration = performance.now() - startTime;

        // Log performance avec monitoring complet
        if (queryDuration > CONFIG.performance.slowQueryThreshold) {
          captureMessage('Slow templates query detected', {
            level: 'warning',
            tags: {
              component: 'templates_page',
              performance: true,
            },
            extra: {
              duration: queryDuration,
              templatesCount: result.rows.length,
              queryTimeout: CONFIG.performance.queryTimeout,
            },
          });
        }

        // Log de succès en dev
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[Templates] Query exécutée en ${Math.round(queryDuration)}ms (timeout: ${CONFIG.performance.queryTimeout}ms)`,
          );
        }

        // Succès
        return {
          templates: result.rows,
          success: true,
          queryDuration,
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
        component: 'templates_page',
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
      templates: [],
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
function TemplatesError({ errorType, userMessage, shouldRetry }) {
  return (
    <div className="templates-error-page">
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
                    : '⚠️'}
            </div>
            <h1 className="error-code">
              {errorType === ERROR_TYPES.TIMEOUT ? '503' : '500'}
            </h1>
            <h2 className="error-title">
              {shouldRetry
                ? 'Service temporairement indisponible'
                : 'Erreur technique'}
            </h2>
            <p className="error-message">{userMessage}</p>
            <div className="error-actions">
              {shouldRetry && (
                <button
                  onClick={() => window.location.reload()}
                  className="cta-button primary"
                >
                  🔄 Réessayer
                </button>
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
                    <strong>Page:</strong> templates (liste)
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
export default async function TemplatesPage() {
  // Récupérer les données avec gestion d'erreurs avancée
  const data = await getTemplates();

  // Gestion différenciée des erreurs
  if (!data.success) {
    // En production, on peut choisir de montrer une page d'erreur custom
    // plutôt que notFound() pour certains types d'erreurs temporaires
    if (data.shouldRetry && process.env.NODE_ENV === 'production') {
      return (
        <TemplatesError
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
      <TemplatesError
        errorType={data.errorType}
        userMessage={data.userMessage}
        shouldRetry={data.shouldRetry}
      />
    );
  }

  // Cas spécial : pas de templates (valide pour e-commerce en démarrage)
  if (!data.templates || data.templates.length === 0) {
    return (
      <div className="templates-empty-state">
        <section className="first">
          <div className="empty-content">
            <div className="empty-card">
              <div className="empty-icon">📋</div>
              <h1 className="empty-title">Aucun template disponible</h1>
              <p className="empty-message">
                Nos templates sont en cours de préparation.
              </p>
              <p className="empty-submessage">
                Revenez bientôt pour découvrir notre collection de templates
                professionnels.
              </p>
              <div className="empty-actions">
                <Link href="/" className="cta-button primary">
                  🏠 Retour à l&apos;accueil
                </Link>
                <Link href="/contact" className="cta-button secondary">
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
      <TemplatesList templates={data.templates} />
    </Suspense>
  );
}

// Metadata pour SEO e-commerce avec monitoring en cas d'erreur
export const metadata = {
  title: 'Templates - Benew | Solutions E-commerce',
  description:
    'Découvrez notre collection de templates e-commerce professionnels. Solutions complètes pour votre boutique en ligne.',
  keywords: [
    'templates e-commerce',
    'boutique en ligne',
    'solutions e-commerce',
    'templates professionnels',
    'Benew',
    'Djibouti',
  ],
  openGraph: {
    title: 'Templates E-commerce Benew',
    description:
      'Collection de templates professionnels pour votre boutique en ligne.',
    // url: `${process.env.NEXT_PUBLIC_SITE_URL}/templates`,
  },
  // alternates: {
  //   canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/templates`,
  // },
};

// Configuration ISR Next.js 15
export const revalidate = 300;

// Force static pour performance optimale
export const dynamic = 'force-static';
