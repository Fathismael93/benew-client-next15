/* eslint-disable no-unused-vars */
// app/templates/[id]/page.jsx
// Server Component optimisé pour détail d'un template e-commerce
// Next.js 15 + PostgreSQL + Monitoring essentiel + Gestion d'erreurs avancée

import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import SingleTemplateShops from '@/components/templates/SingleTemplateShops';
import { getClient } from '@/backend/dbConnect';
import { captureException, captureMessage } from '../../../instrumentation';
import {
  isValidPostgreSQLUUID,
  sanitizeAndValidateUUID,
} from '@/utils/validation';
import Loading from './loading';

// Configuration étendue avec timeouts
const CONFIG = {
  cache: {
    revalidate: 300, // 5 minutes ISR pour succès
    errorRevalidate: 60, // 1 minute pour erreurs temporaires
  },
  performance: {
    slowQueryThreshold: 1500,
    queryTimeout: 8000, // 8 secondes timeout
  },
  retry: {
    maxAttempts: 2,
    baseDelay: 100,
  },
};

// Types d'erreurs standardisés
const ERROR_TYPES = {
  NOT_FOUND: 'not_found',
  DATABASE_ERROR: 'database_error',
  TIMEOUT: 'timeout',
  CONNECTION_ERROR: 'connection_error',
  PERMISSION_ERROR: 'permission_error',
  VALIDATION_ERROR: 'validation_error',
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
 * Classifie les erreurs PostgreSQL
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
      userMessage: 'La requête a pris trop de temps. Veuillez réessayer.',
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

  // Timeout général (pas PostgreSQL)
  if (message.includes('timeout') || error.name === 'TimeoutError') {
    return {
      type: ERROR_TYPES.TIMEOUT,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: 'La requête a pris trop de temps. Veuillez réessayer.',
    };
  }

  // Erreur de base de données générique
  return {
    type: ERROR_TYPES.DATABASE_ERROR,
    shouldRetry: false,
    httpStatus: 500,
    userMessage: 'Erreur technique temporaire.',
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
        `Retrying template data fetch (attempt ${attempt}/${maxAttempts})`,
        {
          level: 'info',
          tags: { component: 'single_template_page', retry: true },
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
 * Fonction principale avec gestion d'erreurs avancée
 */
async function getTemplateData(templateId) {
  const startTime = performance.now();

  try {
    return await executeWithRetry(async () => {
      const client = await getClient();

      try {
        // Exécuter les requêtes avec timeout
        const queryPromise = Promise.all([
          // 1. Vérifier que le template existe
          client.query(
            `SELECT 
              template_id,
              template_name,
              template_image,
              template_has_web,
              template_has_mobile
            FROM catalog.templates 
            WHERE template_id = $1 AND is_active = true`,
            [templateId],
          ),

          // 2. Récupérer les applications du template
          client.query(
            `SELECT 
              a.application_id, 
              a.application_name, 
              a.application_category, 
              a.application_fee, 
              a.application_rent, 
              a.application_images, 
              a.application_level,
              t.template_name
            FROM catalog.applications a
            JOIN catalog.templates t ON a.application_template_id = t.template_id 
            WHERE a.application_template_id = $1 
              AND a.is_active = true 
              AND t.is_active = true
            ORDER BY a.application_level ASC, a.created_at DESC`,
            [templateId],
          ),

          // 3. Récupérer les plateformes de paiement
          client.query(
            `SELECT 
              platform_id, 
              platform_name, 
              platform_number
            FROM admin.platforms
            WHERE is_active = true
            ORDER BY platform_name ASC`,
          ),
        ]);

        const [templateResult, applicationsResult, platformsResult] =
          await withTimeout(
            queryPromise,
            CONFIG.performance.queryTimeout,
            'Database query timeout',
          );

        const queryDuration = performance.now() - startTime;

        // Log performance
        if (queryDuration > CONFIG.performance.slowQueryThreshold) {
          captureMessage('Slow template detail query', {
            level: 'warning',
            tags: { component: 'single_template_page', performance: true },
            extra: {
              templateId,
              duration: queryDuration,
              applicationsCount: applicationsResult.rows.length,
            },
          });
        }

        // Template non trouvé (cas normal)
        if (templateResult.rows.length === 0) {
          return {
            template: null,
            applications: [],
            platforms: [],
            success: false,
            errorType: ERROR_TYPES.NOT_FOUND,
            httpStatus: 404,
            userMessage: 'Template non trouvé.',
          };
        }

        // Succès
        return {
          template: templateResult.rows[0],
          applications: applicationsResult.rows,
          platforms: platformsResult.rows,
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

    // Log détaillé pour monitoring
    captureException(error, {
      tags: {
        component: 'single_template_page',
        error_type: errorInfo.type,
        should_retry: errorInfo.shouldRetry.toString(),
        http_status: errorInfo.httpStatus.toString(),
      },
      extra: {
        templateId,
        queryDuration,
        pgErrorCode: error.code,
        errorMessage: error.message,
      },
    });

    return {
      template: null,
      applications: [],
      platforms: [],
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
 * Composant d'erreur réutilisable
 */
function TemplateError({ errorType, userMessage, shouldRetry, templateId }) {
  return (
    <div>
      <div>
        <div>
          {errorType === ERROR_TYPES.NOT_FOUND ? (
            <>
              <h1>404</h1>
              <h2>Template introuvable</h2>
              <p>
                Le template que vous recherchez n&apos;existe pas ou a été
                supprimé.
              </p>
              <a href="/templates">Voir tous les templates</a>
            </>
          ) : (
            <>
              <h1>{errorType === ERROR_TYPES.TIMEOUT ? '503' : '500'}</h1>
              <h2>
                {shouldRetry
                  ? 'Service temporairement indisponible'
                  : 'Erreur technique'}
              </h2>
              <p>{userMessage}</p>
              {shouldRetry && (
                <button onClick={() => window.location.reload()}>
                  Réessayer
                </button>
              )}
              <a href="/templates">Retour aux templates</a>
            </>
          )}
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div>
            <p>
              <strong>Debug Info:</strong>
            </p>
            <p>Error Type: {errorType}</p>
            <p>Template ID: {templateId}</p>
            <p>Should Retry: {shouldRetry ? 'Yes' : 'No'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Composant principal avec gestion d'erreurs différenciée
 */
export default async function SingleTemplatePage({ params }) {
  const { id: rawTemplateId } = await params;

  // Validation UUID
  const templateId = sanitizeAndValidateUUID(rawTemplateId);

  if (!templateId) {
    captureMessage('Invalid template ID format', {
      level: 'info',
      tags: { component: 'single_template_page', validation: true },
      extra: { rawTemplateId },
    });

    notFound();
  }

  // Récupérer les données avec gestion d'erreurs avancée
  const data = await getTemplateData(templateId);

  // Gestion différenciée des erreurs
  if (!data.success) {
    // Template non trouvé → 404
    if (data.errorType === ERROR_TYPES.NOT_FOUND) {
      notFound();
    }

    // Autres erreurs → Page d'erreur customisée
    return (
      <TemplateError
        errorType={data.errorType}
        userMessage={data.userMessage}
        shouldRetry={data.shouldRetry}
        templateId={templateId}
      />
    );
  }

  // Cas spécial : template trouvé mais pas d'applications
  if (!data.applications || data.applications.length === 0) {
    return (
      <div>
        <div>
          <h1>{data.template.template_name}</h1>
          <p>Aucune application disponible pour ce template.</p>
          <p>Revenez bientôt pour découvrir les nouvelles applications.</p>
          <a href="/templates">Voir d&apos;autres templates</a>
        </div>
      </div>
    );
  }

  // Rendu normal avec Suspense et ErrorBoundary
  return (
    // <ErrorBoundary>
    <Suspense fallback={<Loading />}>
      <SingleTemplateShops
        templateID={templateId}
        applications={data.applications}
        platforms={data.platforms}
      />
    </Suspense>
    // </ErrorBoundary>
  );
}

/**
 * Génération metadata avec gestion d'erreurs
 */
export async function generateMetadata({ params }) {
  const { id: rawTemplateId } = await params;
  const templateId = sanitizeAndValidateUUID(rawTemplateId);

  if (!templateId) {
    return {
      title: 'Template Invalide | Benew',
      description: 'Template non trouvé ou identifiant invalide.',
      robots: { index: false, follow: false },
    };
  }

  try {
    const client = await getClient();
    try {
      const queryPromise = client.query(
        'SELECT template_name FROM catalog.templates WHERE template_id = $1 AND is_active = true',
        [templateId],
      );

      const result = await withTimeout(
        queryPromise,
        2000, // Timeout plus court pour metadata
        'Metadata query timeout',
      );

      if (result.rows.length > 0) {
        const templateName = result.rows[0].template_name;

        return {
          title: `${templateName} - Applications Disponibles | Benew`,
          description: `Découvrez le template ${templateName} et ses applications professionnelles. Solutions web et mobile pour votre business.`,
          keywords: [
            templateName,
            'template e-commerce',
            'application web',
            'application mobile',
            'Benew',
            'Djibouti',
          ],
          openGraph: {
            title: `${templateName} - Template Benew`,
            description: `Explorez le template ${templateName} avec ses applications professionnelles disponibles.`,
            url: `${process.env.NEXT_PUBLIC_SITE_URL}/templates/${templateId}`,
          },
          alternates: {
            canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/templates/${templateId}`,
          },
        };
      }
    } finally {
      client.release();
    }
  } catch (error) {
    const errorInfo = classifyError(error);

    // Log mais pas d'exception pour metadata
    captureMessage('Metadata generation failed', {
      level: 'warning',
      tags: {
        component: 'single_template_metadata',
        error_type: errorInfo.type,
      },
      extra: { templateId, errorMessage: error.message },
    });
  }

  // Metadata par défaut
  return {
    title: 'Template - Applications Disponibles | Benew',
    description:
      'Découvrez ce template et ses applications professionnelles disponibles.',
    openGraph: {
      title: 'Template Benew',
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/templates/${templateId}`,
    },
  };
}

// Configuration ISR différenciée selon le type de réponse
export const revalidate = CONFIG.cache.revalidate;
export const dynamic = 'force-static';
