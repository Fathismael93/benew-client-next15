/* eslint-disable no-unused-vars */
// app/templates/[id]/applications/[appID]/page.jsx
// Server Component optimisé pour détail d'une application e-commerce
// Next.js 15 + PostgreSQL + Monitoring complet + Validation UUID + Timeouts + Gestion d'erreurs avancée

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';

import SingleApplication from '@/components/templates/SingleApplication';
import { getClient } from '@/backend/dbConnect';
import {
  captureException,
  captureMessage,
} from '../../../../../instrumentation';
import { sanitizeAndValidateUUID } from '@/utils/validation';
import Loading from './loading';

// Configuration étendue avec timeouts et gestion d'erreurs
const CONFIG = {
  cache: {
    revalidate: 300, // 5 minutes ISR pour succès
    errorRevalidate: 60, // 1 minute pour erreurs temporaires
  },
  performance: {
    slowQueryThreshold: 1500, // Alerte pour queries lentes
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
  IMAGE_LOADING_ERROR: 'image_loading_error',
  PRICING_ERROR: 'pricing_error',
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

  // Application non trouvée (message spécifique)
  if (
    message.includes('not found') ||
    message.includes('404') ||
    message.includes('introuvable') ||
    message.includes('nexiste pas') ||
    message.includes('application not found')
  ) {
    return {
      type: ERROR_TYPES.NOT_FOUND,
      shouldRetry: false,
      httpStatus: 404,
      userMessage: 'Cette application est introuvable.',
    };
  }

  // Erreurs réseau
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connexion')
  ) {
    return {
      type: ERROR_TYPES.CONNECTION_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: 'Problème de connexion réseau.',
    };
  }

  // Erreurs d'images
  if (message.includes('cloudinary') || message.includes('image')) {
    return {
      type: ERROR_TYPES.IMAGE_LOADING_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: "Problème de chargement des images de l'application.",
    };
  }

  // Erreurs de prix/paiement
  if (
    message.includes('price') ||
    message.includes('payment') ||
    message.includes('prix')
  ) {
    return {
      type: ERROR_TYPES.PRICING_ERROR,
      shouldRetry: true,
      httpStatus: 503,
      userMessage: 'Erreur lors du chargement des informations de prix.',
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
    userMessage:
      "Une erreur inattendue est survenue lors du chargement de l'application.",
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
        `Retrying application data fetch (attempt ${attempt}/${maxAttempts})`,
        {
          level: 'info',
          tags: { component: 'single_application_page', retry: true },
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
 * Validation robuste des IDs avec UUID
 */
function validateIds(appId, templateId) {
  // Validation et nettoyage de l'ID application
  const cleanApplicationId = sanitizeAndValidateUUID(appId);
  if (!cleanApplicationId) {
    return {
      isValid: false,
      error: 'Application ID format invalide',
      field: 'applicationId',
      errorType: ERROR_TYPES.VALIDATION_ERROR,
    };
  }

  // Validation et nettoyage de l'ID template
  const cleanTemplateId = sanitizeAndValidateUUID(templateId);
  if (!cleanTemplateId) {
    return {
      isValid: false,
      error: 'Template ID format invalide',
      field: 'templateId',
      errorType: ERROR_TYPES.VALIDATION_ERROR,
    };
  }

  return {
    isValid: true,
    applicationId: cleanApplicationId,
    templateId: cleanTemplateId,
  };
}

/**
 * Fonction principale avec gestion d'erreurs avancée et retry
 */
async function getApplicationData(applicationId, templateId) {
  const startTime = performance.now();

  try {
    return await executeWithRetry(async () => {
      const client = await getClient();

      try {
        // Exécuter toutes les requêtes en parallèle avec timeout
        const queryPromise = Promise.all([
          // 1. Application avec contexte du template
          client.query(
            `SELECT 
              -- Application
              a.application_id,
              a.application_name,
              a.application_link,
              a.application_admin_link,
              a.application_description,
              a.application_category,
              a.application_fee,
              a.application_rent,
              a.application_images,
              a.application_level,
              a.sales_count as application_sales,
              
              -- Template parent
              t.template_id,
              t.template_name,
              
              -- Stats basiques du template
              (SELECT COUNT(*) FROM catalog.applications 
               WHERE application_template_id = t.template_id AND is_active = true) as template_total_applications
              
            FROM catalog.applications a
            JOIN catalog.templates t ON a.application_template_id = t.template_id
            WHERE a.application_id = $1 
              AND a.application_template_id = $2
              AND a.is_active = true 
              AND t.is_active = true`,
            [applicationId, templateId],
          ),

          // 2. Applications similaires
          client.query(
            `SELECT 
              application_id,
              application_name,
              application_category,
              application_fee,
              application_level,
              application_images[1] as primary_image,
              sales_count
            FROM catalog.applications
            WHERE application_template_id = $1 
              AND application_id != $2
              AND is_active = true
            ORDER BY application_level ASC, sales_count DESC
            LIMIT 6`,
            [templateId, applicationId],
          ),

          // 3. Plateformes de paiement
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

        const [applicationResult, relatedAppsResult, platformsResult] =
          await withTimeout(
            queryPromise,
            CONFIG.performance.queryTimeout,
            'Database query timeout',
          );

        const queryDuration = performance.now() - startTime;

        // Log performance avec monitoring complet
        if (queryDuration > CONFIG.performance.slowQueryThreshold) {
          captureMessage('Slow application detail query', {
            level: 'warning',
            tags: {
              component: 'single_application_page',
              performance: true,
            },
            extra: {
              applicationId,
              templateId,
              duration: queryDuration,
              timeout: CONFIG.performance.queryTimeout,
              relatedAppsCount: relatedAppsResult.rows.length,
              platformsCount: platformsResult.rows.length,
            },
          });
        }

        // Log de succès en dev
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[Application] Query exécutée en ${Math.round(queryDuration)}ms (timeout: ${CONFIG.performance.queryTimeout}ms)`,
          );
        }

        // Application non trouvée (cas normal)
        if (applicationResult.rows.length === 0) {
          return {
            application: null,
            template: null,
            relatedApplications: [],
            platforms: [],
            success: false,
            errorType: ERROR_TYPES.NOT_FOUND,
            httpStatus: 404,
            userMessage: 'Cette application est introuvable.',
          };
        }

        const mainData = applicationResult.rows[0];

        // Séparer les données application et template
        const application = {
          application_id: mainData.application_id,
          application_name: mainData.application_name,
          application_link: mainData.application_link,
          application_admin_link: mainData.application_admin_link,
          application_description: mainData.application_description,
          application_category: mainData.application_category,
          application_fee: mainData.application_fee,
          application_rent: mainData.application_rent,
          application_images: mainData.application_images,
          application_level: mainData.application_level,
          application_sales: mainData.application_sales,
        };

        const template = {
          template_id: mainData.template_id,
          template_name: mainData.template_name,
          template_total_applications: mainData.template_total_applications,
        };

        // Succès
        return {
          application,
          template,
          relatedApplications: relatedAppsResult.rows,
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

    // Log détaillé pour monitoring avec tous les contextes
    captureException(error, {
      tags: {
        component: 'single_application_page',
        error_type: errorInfo.type,
        should_retry: errorInfo.shouldRetry.toString(),
        http_status: errorInfo.httpStatus.toString(),
      },
      extra: {
        applicationId,
        templateId,
        queryDuration,
        pgErrorCode: error.code,
        errorMessage: error.message,
        timeout: CONFIG.performance.queryTimeout,
      },
    });

    return {
      application: null,
      template: null,
      relatedApplications: [],
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
 * Composant d'erreur réutilisable avec design cohérent
 */
function ApplicationError({
  errorType,
  userMessage,
  shouldRetry,
  templateId,
  applicationId,
}) {
  return (
    <div className="application-error-page">
      <section className="first">
        <div className="error-content">
          {errorType === ERROR_TYPES.NOT_FOUND ? (
            <div className="not-found-error">
              <div className="error-icon">🔍</div>
              <h1 className="error-code">404</h1>
              <h2 className="error-title">Application introuvable</h2>
              <p className="error-message">
                L&apos;application que vous recherchez n&apos;existe pas ou a
                été supprimée.
              </p>
              <div className="error-actions">
                <Link
                  href={`/templates/${templateId}`}
                  className="cta-button primary"
                >
                  🔙 Retour au template
                </Link>
                <Link href="/templates" className="cta-button secondary">
                  📋 Voir tous les templates
                </Link>
                <Link href="/" className="cta-button outline">
                  🏠 Accueil
                </Link>
              </div>
            </div>
          ) : (
            <div className="server-error">
              <div className="error-icon">
                {errorType === ERROR_TYPES.TIMEOUT
                  ? '⏱️'
                  : errorType === ERROR_TYPES.IMAGE_LOADING_ERROR
                    ? '🖼️'
                    : errorType === ERROR_TYPES.PRICING_ERROR
                      ? '💰'
                      : '⚠️'}
              </div>
              <h1 className="error-code">
                {errorType === ERROR_TYPES.TIMEOUT ? '503' : '500'}
              </h1>
              <h2 className="error-title">
                {shouldRetry ? 'Erreur temporaire' : 'Erreur technique'}
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
                <Link
                  href={`/templates/${templateId}`}
                  className="cta-button secondary"
                >
                  🔙 Retour au template
                </Link>
                <Link href="/templates" className="cta-button outline">
                  📋 Voir tous les templates
                </Link>
                <Link href="/" className="cta-button outline">
                  🏠 Accueil
                </Link>
              </div>
            </div>
          )}

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
                    <strong>ID Application:</strong> {applicationId}
                  </p>
                  <p>
                    <strong>ID Template:</strong> {templateId}
                  </p>
                  <p>
                    <strong>Peut réessayer:</strong>{' '}
                    {shouldRetry ? 'Oui' : 'Non'}
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
export default async function SingleApplicationPage({ params }) {
  const { id: templateId, appID: appId } = await params;

  // Validation robuste avec UUID et monitoring
  const validation = validateIds(appId, templateId);
  if (!validation.isValid) {
    // Log de la tentative d'accès avec ID invalide
    captureMessage('Invalid ID format in application page', {
      level: 'info',
      tags: {
        component: 'single_application_page',
        validation: true,
        error_type: validation.errorType,
      },
      extra: {
        rawAppId: appId,
        rawTemplateId: templateId,
        validationError: validation.error,
        invalidField: validation.field,
      },
    });

    notFound();
  }

  // Récupérer les données avec gestion d'erreurs et timeout avancée
  const data = await getApplicationData(
    validation.applicationId,
    validation.templateId,
  );

  // Gestion différenciée des erreurs
  if (!data.success) {
    // Application non trouvée → 404
    if (data.errorType === ERROR_TYPES.NOT_FOUND) {
      notFound();
    }

    // Autres erreurs → Page d'erreur customisée
    return (
      <ApplicationError
        errorType={data.errorType}
        userMessage={data.userMessage}
        shouldRetry={data.shouldRetry}
        templateId={validation.templateId}
        applicationId={validation.applicationId}
      />
    );
  }

  if (!data.application) {
    notFound();
  }

  // Rendu normal avec Suspense - Error Boundary géré par error.jsx
  return (
    <Suspense fallback={<Loading />}>
      <SingleApplication
        application={data.application}
        template={data.template}
        relatedApplications={data.relatedApplications}
        platforms={data.platforms}
        context={{
          templateId: validation.templateId,
          applicationId: validation.applicationId,
        }}
      />
    </Suspense>
  );
}

/**
 * Génération dynamique des metadata avec validation UUID, timeout et gestion d'erreurs
 */
export async function generateMetadata({ params }) {
  const { id: templateId, appID: appId } = await params;

  // Validation robuste avec UUID
  const validation = validateIds(appId, templateId);
  if (!validation.isValid) {
    return {
      title: 'Application non trouvée - Benew',
      description:
        "L'application demandée n'existe pas ou l'identifiant est invalide.",
      robots: { index: false, follow: false },
    };
  }

  try {
    const client = await getClient();
    try {
      const queryPromise = client.query(
        `SELECT 
          a.application_name,
          a.application_description,
          a.application_category,
          a.application_images,
          t.template_name
        FROM catalog.applications a
        JOIN catalog.templates t ON a.application_template_id = t.template_id
        WHERE a.application_id = $1 
          AND a.application_template_id = $2
          AND a.is_active = true`,
        [validation.applicationId, validation.templateId],
      );

      const result = await withTimeout(
        queryPromise,
        2000, // Timeout plus court pour metadata
        'Metadata query timeout',
      );

      if (result.rows.length > 0) {
        const app = result.rows[0];

        return {
          title: `${app.application_name} - ${app.template_name} | Benew`,
          description:
            app.application_description ||
            `Découvrez l'application ${app.application_name} du template ${app.template_name} sur Benew.`,
          keywords: [
            app.application_name,
            app.template_name,
            app.application_category,
            'application e-commerce',
            'Benew',
            'Djibouti',
          ],
          openGraph: {
            title: `${app.application_name} - ${app.template_name}`,
            description:
              app.application_description ||
              `Application ${app.application_name} disponible sur Benew.`,
            images:
              app.application_images?.length > 0
                ? [app.application_images[0]]
                : [],
            url: `${process.env.NEXT_PUBLIC_SITE_URL}/templates/${validation.templateId}/applications/${validation.applicationId}`,
          },
          alternates: {
            canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/templates/${validation.templateId}/applications/${validation.applicationId}`,
          },
        };
      }
    } finally {
      client.release();
    }
  } catch (error) {
    const errorInfo = classifyError(error);

    // Log mais pas d'exception pour metadata
    captureMessage('Metadata generation failed for application', {
      level: 'warning',
      tags: {
        component: 'single_application_metadata',
        error_type: errorInfo.type,
      },
      extra: {
        applicationId: validation.applicationId,
        templateId: validation.templateId,
        errorMessage: error.message,
      },
    });
  }

  // Metadata par défaut
  return {
    title: 'Application - Benew',
    description: 'Découvrez cette application sur Benew.',
    openGraph: {
      title: 'Application Benew',
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/templates/${validation.templateId}/applications/${validation.applicationId}`,
    },
  };
}

// Configuration ISR Next.js 15
export const revalidate = 300;

// Force static pour performance optimale
export const dynamic = 'force-static';
