/* eslint-disable no-unused-vars */
// app/templates/[id]/page.jsx
// Server Component optimisé pour détail d'un template e-commerce
// Next.js 15 + PostgreSQL + Monitoring essentiel + Gestion d'erreurs avancée

import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';

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
 * Composant d'erreur réutilisable avec design cohérent
 */
function TemplateError({ errorType, userMessage, shouldRetry, templateId }) {
  return (
    <div className="template-error-page">
      <section className="first">
        <div className="error-content">
          {errorType === ERROR_TYPES.NOT_FOUND ? (
            <div className="not-found-error">
              <div className="error-icon">🔍</div>
              <h1 className="error-code">404</h1>
              <h2 className="error-title">Template introuvable</h2>
              <p className="error-message">
                Le template que vous recherchez n&apos;existe pas ou a été
                supprimé.
              </p>
              <div className="error-actions">
                <Link href="/templates" className="cta-button primary">
                  📋 Voir tous les templates
                </Link>
                <Link href="/" className="cta-button secondary">
                  🏠 Accueil
                </Link>
              </div>
            </div>
          ) : (
            <div className="server-error">
              <div className="error-icon">
                {errorType === ERROR_TYPES.TIMEOUT ? '⏱️' : '⚠️'}
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
                <Link href="/templates" className="cta-button secondary">
                  📋 Retour aux templates
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

      <style>{`
        .template-error-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #0c0c1a 0%, #1a1a2e 100%);
          color: #fae6d1;
        }

        .error-content {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2rem 1rem;
        }

        .not-found-error,
        .server-error {
          max-width: 600px;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(15px);
          border-radius: 20px;
          border: 1px solid rgba(246, 160, 55, 0.25);
          padding: 3rem 2rem;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
        }

        .error-icon {
          font-size: 4rem;
          margin-bottom: 1.5rem;
          animation: gentle-pulse 3s ease-in-out infinite;
        }

        @keyframes gentle-pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }

        .error-code {
          font-size: 3rem;
          font-weight: 700;
          color: #f6a037;
          margin-bottom: 1rem;
          text-shadow: 0 2px 4px rgba(246, 160, 55, 0.3);
        }

        .error-title {
          font-size: 1.8rem;
          font-weight: 600;
          color: #fae6d1;
          margin-bottom: 1rem;
          line-height: 1.3;
        }

        .error-message {
          font-size: 1.1rem;
          color: rgba(250, 230, 209, 0.7);
          line-height: 1.6;
          margin-bottom: 2rem;
        }

        .error-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .cta-button {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.875rem 1.5rem;
          font-size: 0.95rem;
          font-weight: 600;
          border-radius: 12px;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.3s ease;
          min-height: 48px;
          border: none;
        }

        .cta-button.primary {
          background: linear-gradient(135deg, #f6a037, #f266b0);
          color: #0c0c1a;
          box-shadow: 0 4px 15px rgba(246, 160, 55, 0.3);
        }

        .cta-button.primary:hover {
          background: linear-gradient(135deg, #f266b0, #9e1f9d);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(242, 102, 176, 0.4);
        }

        .cta-button.secondary {
          background: transparent;
          color: #f6a037;
          border: 2px solid #f6a037;
          backdrop-filter: blur(10px);
        }

        .cta-button.secondary:hover {
          background: rgba(246, 160, 55, 0.15);
          border-color: #f266b0;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(246, 160, 55, 0.3);
        }

        .cta-button.outline {
          background: transparent;
          color: rgba(250, 230, 209, 0.8);
          border: 1px solid rgba(250, 230, 209, 0.3);
        }

        .cta-button.outline:hover {
          background: rgba(250, 230, 209, 0.1);
          color: #fae6d1;
          border-color: rgba(250, 230, 209, 0.5);
        }

        .debug-section {
          margin-top: 2rem;
          max-width: 500px;
        }

        .debug-details {
          background: rgba(246, 160, 55, 0.05);
          border: 1px solid rgba(246, 160, 55, 0.2);
          border-radius: 8px;
          padding: 1rem;
          text-align: left;
        }

        .debug-summary {
          color: #f6a037;
          cursor: pointer;
          font-weight: 500;
          margin-bottom: 0.5rem;
        }

        .debug-content p {
          color: rgba(250, 230, 209, 0.8);
          font-size: 0.85rem;
          margin: 0.25rem 0;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .error-content {
            padding: 1.5rem 1rem;
          }

          .not-found-error,
          .server-error {
            padding: 2rem 1.5rem;
          }

          .error-code {
            font-size: 2.5rem;
          }

          .error-title {
            font-size: 1.5rem;
          }

          .error-actions {
            flex-direction: column;
            width: 100%;
          }

          .cta-button {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 360px) {
          .error-icon {
            font-size: 3rem;
          }

          .error-code {
            font-size: 2rem;
          }

          .error-title {
            font-size: 1.3rem;
          }

          .error-message {
            font-size: 1rem;
          }

          .cta-button {
            padding: 0.75rem 1.25rem;
            font-size: 0.9rem;
          }
        }

        /* Accessibilité */
        @media (prefers-reduced-motion: reduce) {
          .error-icon {
            animation: none;
          }

          .cta-button:hover {
            transform: none;
          }
        }
      `}</style>
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
      <div className="template-empty-state">
        <section className="first">
          <div className="empty-content">
            <div className="empty-card">
              <div className="empty-icon">📱</div>
              <h1 className="empty-title">{data.template.template_name}</h1>
              <p className="empty-message">
                Aucune application disponible pour ce template.
              </p>
              <p className="empty-submessage">
                Revenez bientôt pour découvrir les nouvelles applications.
              </p>
              <div className="empty-actions">
                <Link href="/templates" className="cta-button primary">
                  📋 Voir d&apos;autres templates
                </Link>
                <Link href="/" className="cta-button secondary">
                  🏠 Accueil
                </Link>
              </div>
            </div>
          </div>
        </section>

        <style>{`
          .template-empty-state {
            min-height: 100vh;
            background: linear-gradient(135deg, #0c0c1a 0%, #1a1a2e 100%);
            color: #fae6d1;
          }

          .empty-content {
            width: 100%;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem 1rem;
          }

          .empty-card {
            max-width: 500px;
            background: rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(15px);
            border-radius: 20px;
            border: 1px solid rgba(246, 160, 55, 0.25);
            padding: 3rem 2rem;
            text-align: center;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
          }

          .empty-icon {
            font-size: 4rem;
            margin-bottom: 1.5rem;
            animation: gentle-bounce 2s ease-in-out infinite;
          }

          @keyframes gentle-bounce {
            0%,
            100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-10px);
            }
          }

          .empty-title {
            font-size: 2rem;
            font-weight: 700;
            color: #f6a037;
            margin-bottom: 1rem;
            text-shadow: 0 2px 4px rgba(246, 160, 55, 0.3);
          }

          .empty-message {
            font-size: 1.2rem;
            color: #fae6d1;
            margin-bottom: 0.5rem;
            line-height: 1.4;
          }

          .empty-submessage {
            font-size: 1rem;
            color: rgba(250, 230, 209, 0.7);
            margin-bottom: 2rem;
            line-height: 1.6;
          }

          .empty-actions {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
          }

          .cta-button {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.875rem 1.5rem;
            font-size: 0.95rem;
            font-weight: 600;
            border-radius: 12px;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.3s ease;
            min-height: 48px;
          }

          .cta-button.primary {
            background: linear-gradient(135deg, #f6a037, #f266b0);
            color: #0c0c1a;
            box-shadow: 0 4px 15px rgba(246, 160, 55, 0.3);
          }

          .cta-button.primary:hover {
            background: linear-gradient(135deg, #f266b0, #9e1f9d);
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(242, 102, 176, 0.4);
          }

          .cta-button.secondary {
            background: transparent;
            color: #f6a037;
            border: 2px solid #f6a037;
            backdrop-filter: blur(10px);
          }

          .cta-button.secondary:hover {
            background: rgba(246, 160, 55, 0.15);
            border-color: #f266b0;
            transform: translateY(-3px);
            box-shadow: 0 6px 20px rgba(246, 160, 55, 0.3);
          }

          /* Responsive */
          @media (max-width: 768px) {
            .empty-content {
              padding: 1.5rem 1rem;
            }

            .empty-card {
              padding: 2rem 1.5rem;
            }

            .empty-title {
              font-size: 1.7rem;
            }

            .empty-actions {
              flex-direction: column;
              width: 100%;
            }

            .cta-button {
              width: 100%;
              justify-content: center;
            }
          }

          @media (max-width: 360px) {
            .empty-icon {
              font-size: 3rem;
            }

            .empty-title {
              font-size: 1.5rem;
            }

            .empty-message {
              font-size: 1.1rem;
            }

            .empty-submessage {
              font-size: 0.95rem;
            }

            .cta-button {
              padding: 0.75rem 1.25rem;
              font-size: 0.9rem;
            }
          }

          /* Accessibilité */
          @media (prefers-reduced-motion: reduce) {
            .empty-icon {
              animation: none;
            }

            .cta-button:hover {
              transform: none;
            }
          }
        `}</style>
      </div>
    );
  }

  // Rendu normal avec Suspense - Error Boundary géré par error.jsx
  return (
    <Suspense fallback={<Loading />}>
      <SingleTemplateShops
        templateID={templateId}
        applications={data.applications}
        platforms={data.platforms}
      />
    </Suspense>
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
export const revalidate = 300;
export const dynamic = 'force-static';
