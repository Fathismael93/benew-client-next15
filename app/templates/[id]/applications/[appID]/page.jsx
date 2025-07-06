// app/templates/[id]/applications/[appID]/page.jsx
// Server Component production-ready pour une application spécifique
// Next.js 15 + PostgreSQL + Cache + Monitoring + Rate Limiting + Validation

import { Suspense } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import SingleApplication from '@/components/templates/SingleApplication';
import { getClient, monitoring } from '@/backend/dbConnect';
import {
  projectCache,
  generateCacheKey,
  invalidateProjectCache,
} from '@/utils/cache';
import {
  captureDatabaseError,
  captureException,
  captureMessage,
  captureValidationError,
} from '@/instrumentation';
import {
  optimizeApiCall,
  getSitePerformanceStats,
  getAdaptiveSiteConfig,
} from '@/utils/performance';
import { limitBenewAPI } from '@/backend/rateLimiter';
import { applicationIdSchema, templateIdSchema } from '@/utils/schemas/schema';

// =============================
// CONFIGURATION PRODUCTION
// =============================

const SINGLE_APPLICATION_CONFIG = {
  // Cache configuration - Plus long pour application spécifique
  cache: {
    ttl: 20 * 60 * 1000, // 20 minutes
    staleWhileRevalidate: 15 * 60 * 1000, // 15 minutes
    maxSize: 400,
    entityType: 'single_application',
  },

  // Database configuration
  database: {
    timeout: 12000, // 12 secondes pour requête complexe avec template
    retryAttempts: 3,
    retryDelay: 2000,
  },

  // Performance thresholds
  performance: {
    slowQueryThreshold: 1800, // 1.8 secondes
    alertThreshold: 3500, // 3.5 secondes
  },

  // Rate limiting
  rateLimiting: {
    enabled: true,
    preset: 'TEMPLATES_API',
  },

  // Validation
  validation: {
    strictMode: true,
    sanitizeInputs: true,
    validateTemplateContext: true, // Valider cohérence template/application
  },
};

// =============================
// VALIDATION & HELPERS
// =============================

/**
 * Valide et sanitise l'ID de l'application et du template
 * @param {string} appId - L'ID de l'application à valider
 * @param {string} templateId - L'ID du template à valider
 * @returns {Object} Résultat de validation
 */
async function validateApplicationAndTemplateIds(appId, templateId) {
  const startTime = performance.now();

  try {
    // Validation simultanée des deux IDs
    const [appValidation, templateValidation] = await Promise.all([
      applicationIdSchema.validate(
        { id: appId },
        {
          strict: SINGLE_APPLICATION_CONFIG.validation.strictMode,
          stripUnknown: true,
        },
      ),
      templateIdSchema.validate(
        { id: templateId },
        {
          strict: SINGLE_APPLICATION_CONFIG.validation.strictMode,
          stripUnknown: true,
        },
      ),
    ]);

    const validationDuration = performance.now() - startTime;

    captureMessage('Application and Template IDs validation successful', {
      level: 'debug',
      tags: {
        component: 'single_application_page',
        operation: 'validation',
      },
      extra: {
        applicationId: appValidation.id,
        templateId: templateValidation.id,
        validationDuration,
      },
    });

    return {
      isValid: true,
      applicationId: appValidation.id,
      templateId: templateValidation.id,
      validationDuration,
    };
  } catch (validationError) {
    const validationDuration = performance.now() - startTime;

    captureValidationError(validationError, {
      inputData: { appId, templateId },
      schema: 'applicationIdSchema + templateIdSchema',
      tags: {
        component: 'single_application_page',
        validation_failed: true,
      },
      extra: {
        rawAppId: appId,
        rawTemplateId: templateId,
        validationDuration,
      },
    });

    return {
      isValid: false,
      error: validationError.message,
      validationDuration,
    };
  }
}

/**
 * Requête optimisée pour récupérer les données de l'application avec contexte template
 * @param {string} applicationId - ID de l'application validé
 * @param {string} templateId - ID du template validé
 * @returns {Object} Requêtes SQL optimisées
 */
function getApplicationDataQuery(applicationId, templateId) {
  console.log(
    `Generating queries for applicationId: ${applicationId}, templateId: ${templateId}`,
  );
  return {
    // Requête principale avec JOIN enrichi pour récupérer application + template + autres apps du template
    applicationWithContextQuery: {
      query: `
        SELECT 
          -- Données de l'application principale
          a.application_id,
          a.application_name,
          a.application_link,
          a.application_admin_link,
          a.application_description,
          a.application_category,
          a.application_fee,
          a.application_rent,
          a.application_images,
          a.application_other_versions,
          a.application_level,
          a.sales_count as application_sales,
          a.created_at as application_created,
          a.updated_at as application_updated,
          
          -- Données du template parent
          t.template_id,
          t.template_name,
          t.template_image,
          t.template_has_web,
          t.template_has_mobile,
          t.template_added,
          t.sales_count as template_sales,
          
          -- Statistiques du template
          (
            SELECT COUNT(*) 
            FROM catalog.applications 
            WHERE application_template_id = t.template_id 
              AND is_active = true
          ) as template_total_applications,
          
          (
            SELECT COUNT(*) 
            FROM catalog.applications 
            WHERE application_template_id = t.template_id 
              AND is_active = true 
              AND application_category = 'web'
          ) as template_web_applications,
          
          (
            SELECT COUNT(*) 
            FROM catalog.applications 
            WHERE application_template_id = t.template_id 
              AND is_active = true 
              AND application_category = 'mobile'
          ) as template_mobile_applications
          
        FROM catalog.applications a
        JOIN catalog.templates t ON a.application_template_id = t.template_id
        WHERE a.application_id = $1 
          AND a.application_template_id = $2
          AND a.is_active = true 
          AND t.is_active = true
      `,
      params: [applicationId, templateId],
    },

    // Requête pour récupérer les autres applications du même template (suggestions)
    relatedApplicationsQuery: {
      query: `
        SELECT 
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
        ORDER BY application_level ASC, sales_count DESC, created_at DESC
        LIMIT 6
      `,
      params: [templateId, applicationId],
    },

    // Requête pour les plateformes (optimisée)
    platformsQuery: {
      query: `
        SELECT 
          platform_id,
          platform_name,
          platform_number
        FROM admin.platforms 
        WHERE is_active = true 
        ORDER BY platform_name ASC
      `,
      params: [],
    },

    // Requête de vérification d'existence et cohérence
    existenceCheckQuery: {
      query: `
        SELECT 
          a.application_id,
          a.application_template_id,
          t.template_id,
          (a.application_template_id = t.template_id) as template_match
        FROM catalog.applications a
        LEFT JOIN catalog.templates t ON t.template_id = $2
        WHERE a.application_id = $1
          AND a.is_active = true
      `,
      params: [applicationId, templateId],
    },
  };
}

// =============================
// FONCTION PRINCIPALE DE RÉCUPÉRATION
// =============================

/**
 * Récupère les données de l'application avec toutes les optimisations production
 * @param {string} applicationId - ID de l'application validé
 * @param {string} templateId - ID du template validé
 * @returns {Promise<Object>} Données de l'application avec métadonnées
 */
async function getSingleApplicationWithOptimizations(
  applicationId,
  templateId,
) {
  console.log('We are in the getSingleApplicationWithOptimizations method');
  const startTime = performance.now();
  const cacheKey = generateCacheKey('single_application', {
    applicationId,
    templateId,
  });

  try {
    // 1. Vérifier le cache en premier
    const cachedResult = await projectCache.singleApplication.get(cacheKey);
    if (cachedResult) {
      captureMessage('Single application served from cache', {
        level: 'debug',
        tags: {
          component: 'single_application_page',
          cache_hit: true,
        },
        extra: {
          applicationId,
          templateId,
          cacheKey: cacheKey.substring(0, 50),
          duration: performance.now() - startTime,
        },
      });

      return {
        ...cachedResult,
        metadata: {
          ...cachedResult.metadata,
          fromCache: true,
          cacheKey: cacheKey.substring(0, 50),
        },
      };
    }

    // 2. Récupération depuis la base de données
    const client = await getClient();
    let applicationData = null;

    try {
      console.log('Getting Queries');
      const queries = getApplicationDataQuery(applicationId, templateId);
      const queryStartTime = performance.now();

      console.log('Queries', queries);

      // Exécuter toutes les requêtes en parallèle pour optimiser les performances
      const [
        existenceResult,
        applicationResult,
        relatedAppsResult,
        platformsResult,
      ] = await Promise.all([
        client.query(
          queries.existenceCheckQuery.query,
          queries.existenceCheckQuery.params,
        ),
        client.query(
          queries.applicationWithContextQuery.query,
          queries.applicationWithContextQuery.params,
        ),
        client.query(
          queries.relatedApplicationsQuery.query,
          queries.relatedApplicationsQuery.params,
        ),
        client.query(
          queries.platformsQuery.query,
          queries.platformsQuery.params,
        ),
      ]);

      const queryDuration = performance.now() - queryStartTime;

      // Vérifier l'existence et la cohérence
      if (existenceResult.rows.length === 0) {
        captureMessage('Application not found', {
          level: 'warning',
          tags: {
            component: 'single_application_page',
            application_not_found: true,
          },
          extra: {
            applicationId,
            templateId,
            queryDuration,
          },
        });

        return {
          application: null,
          template: null,
          relatedApplications: [],
          platforms: [],
          metadata: {
            queryDuration,
            fromCache: false,
            timestamp: new Date().toISOString(),
            applicationExists: false,
            templateMatch: false,
          },
        };
      }

      // Vérifier la cohérence template/application
      const existenceData = existenceResult.rows[0];
      if (!existenceData.template_match) {
        captureMessage('Template/Application mismatch detected', {
          level: 'error',
          tags: {
            component: 'single_application_page',
            template_mismatch: true,
          },
          extra: {
            applicationId,
            templateId,
            actualTemplateId: existenceData.application_template_id,
            queryDuration,
          },
        });

        return {
          application: null,
          template: null,
          relatedApplications: [],
          platforms: [],
          metadata: {
            queryDuration,
            fromCache: false,
            timestamp: new Date().toISOString(),
            applicationExists: true,
            templateMatch: false,
            error: true,
            errorMessage: 'Template/Application ID mismatch',
          },
        };
      }

      // Vérifier si l'application avec contexte existe
      if (applicationResult.rows.length === 0) {
        captureMessage('Application context not found', {
          level: 'warning',
          tags: {
            component: 'single_application_page',
            application_context_not_found: true,
          },
          extra: {
            applicationId,
            templateId,
            queryDuration,
          },
        });

        return {
          application: null,
          template: null,
          relatedApplications: [],
          platforms: [],
          metadata: {
            queryDuration,
            fromCache: false,
            timestamp: new Date().toISOString(),
            applicationExists: true,
            templateMatch: true,
            contextAvailable: false,
          },
        };
      }

      // Extraire et structurer les données
      const mainData = applicationResult.rows[0];
      const relatedApplications = relatedAppsResult.rows;
      const platforms = platformsResult.rows;

      console.log('Main Data', mainData);
      console.log('Related Applications', relatedApplications);
      console.log('Platforms', platforms);

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
        application_other_versions: mainData.application_other_versions,
        application_level: mainData.application_level,
        application_sales: mainData.application_sales,
        application_created: mainData.application_created,
        application_updated: mainData.application_updated,
      };

      const template = {
        template_id: mainData.template_id,
        template_name: mainData.template_name,
        template_image: mainData.template_image,
        template_has_web: mainData.template_has_web,
        template_has_mobile: mainData.template_has_mobile,
        template_added: mainData.template_added,
        template_sales: mainData.template_sales,
        template_total_applications: mainData.template_total_applications,
        template_web_applications: mainData.template_web_applications,
        template_mobile_applications: mainData.template_mobile_applications,
      };

      // Log des requêtes lentes
      if (
        queryDuration > SINGLE_APPLICATION_CONFIG.performance.slowQueryThreshold
      ) {
        captureMessage('Slow single application query detected', {
          level: 'warning',
          tags: {
            component: 'single_application_page',
            performance_issue: 'slow_query',
          },
          extra: {
            applicationId,
            templateId,
            duration: queryDuration,
            relatedAppsCount: relatedApplications.length,
            platformsCount: platforms.length,
          },
        });
      }

      // Alerte pour requêtes très lentes
      if (
        queryDuration > SINGLE_APPLICATION_CONFIG.performance.alertThreshold
      ) {
        captureMessage('Critical: Very slow single application query', {
          level: 'error',
          tags: {
            component: 'single_application_page',
            performance_issue: 'critical_slow_query',
          },
          extra: {
            applicationId,
            templateId,
            duration: queryDuration,
            threshold: SINGLE_APPLICATION_CONFIG.performance.alertThreshold,
          },
        });
      }

      // 3. Préparer les résultats avec métadonnées enrichies
      applicationData = {
        application,
        template,
        relatedApplications,
        platforms,
        metadata: {
          queryDuration,
          fromCache: false,
          timestamp: new Date().toISOString(),
          applicationExists: true,
          templateMatch: true,
          contextAvailable: true,
          applicationId,
          templateId,
          relatedAppsCount: relatedApplications.length,
          platformsCount: platforms.length,
          // Statistiques enrichies
          applicationStats: {
            level: application.application_level,
            category: application.application_category,
            salesCount: application.application_sales,
            hasAdminLink: !!application.application_admin_link,
            imagesCount: application.application_images?.length || 0,
            versionsCount: application.application_other_versions?.length || 0,
          },
          templateStats: {
            totalApplications: template.template_total_applications,
            webApplications: template.template_web_applications,
            mobileApplications: template.template_mobile_applications,
            templateSales: template.template_sales,
          },
        },
      };

      // 4. Mettre en cache le résultat
      await projectCache.singleApplication.set(cacheKey, applicationData, {
        ttl: SINGLE_APPLICATION_CONFIG.cache.ttl,
      });

      captureMessage('Single application loaded from database', {
        level: 'info',
        tags: {
          component: 'single_application_page',
          cache_miss: true,
        },
        extra: {
          applicationId,
          templateId,
          duration: queryDuration,
          applicationName: application.application_name,
          templateName: template.template_name,
          relatedAppsCount: relatedApplications.length,
          platformsCount: platforms.length,
        },
      });

      return applicationData;
    } finally {
      // Toujours libérer le client
      client.release();
    }
  } catch (error) {
    const errorDuration = performance.now() - startTime;

    // Gestion spécialisée des erreurs de base de données
    if (/postgres|pg|database|db|connection/i.test(error.message)) {
      captureDatabaseError(error, {
        table: 'catalog.applications, catalog.templates, admin.platforms',
        operation: 'select_single_application_with_context',
        queryType: 'complex_join_with_stats',
        tags: {
          component: 'single_application_page',
        },
        extra: {
          applicationId,
          templateId,
          duration: errorDuration,
          cacheKey: cacheKey.substring(0, 50),
        },
      });
    } else {
      captureException(error, {
        tags: {
          component: 'single_application_page',
          error_type: 'single_application_fetch_error',
        },
        extra: {
          applicationId,
          templateId,
          duration: errorDuration,
          cacheKey: cacheKey.substring(0, 50),
        },
      });
    }

    // Retourner un fallback gracieux
    return {
      application: null,
      template: null,
      relatedApplications: [],
      platforms: [],
      metadata: {
        queryDuration: errorDuration,
        fromCache: false,
        timestamp: new Date().toISOString(),
        applicationExists: false,
        templateMatch: false,
        error: true,
        errorMessage: 'Failed to load application data',
      },
    };
  }
}

// =============================
// FONCTION OPTIMISÉE AVEC PERFORMANCE
// =============================

// Créer une version optimisée avec toutes les améliorations
const getOptimizedSingleApplication = optimizeApiCall(
  getSingleApplicationWithOptimizations,
  {
    entityType: 'single_application',
    cacheTTL: SINGLE_APPLICATION_CONFIG.cache.ttl,
    throttleDelay: 150, // 150ms entre les appels (plus rapide pour UX)
    retryAttempts: SINGLE_APPLICATION_CONFIG.database.retryAttempts,
    retryDelay: SINGLE_APPLICATION_CONFIG.database.retryDelay,
  },
);

// =============================
// COMPOSANT PRINCIPAL
// =============================

/**
 * Server Component pour une page d'application spécifique
 * Production-ready avec validation, cache et monitoring
 */
async function SingleApplicationPage({ params }) {
  const requestStartTime = performance.now();
  const { id: rawTemplateId, appID: rawAppId } = await params;

  console.log(`[Single Application Page] Params:`, {
    rawTemplateId,
    rawAppId,
  });

  try {
    // 1. Validation stricte des IDs de l'application et du template
    const validationResult = await validateApplicationAndTemplateIds(
      rawAppId,
      rawTemplateId,
    );

    console.log('Validation Result', validationResult);

    if (!validationResult.isValid) {
      captureMessage('Single application page: Invalid IDs', {
        level: 'warning',
        tags: {
          component: 'single_application_page',
          issue_type: 'invalid_ids',
        },
        extra: {
          rawAppId,
          rawTemplateId,
          validationError: validationResult.error,
        },
      });

      return notFound();
    }

    const { applicationId, templateId } = validationResult;

    // 2. Rate Limiting (protection contre l'abus)
    if (SINGLE_APPLICATION_CONFIG.rateLimiting.enabled) {
      const headersList = await headers();
      const rateLimitCheck = await limitBenewAPI('templates')({
        headers: headersList,
        url: `/templates/${templateId}/applications/${applicationId}`,
        method: 'GET',
      });

      if (rateLimitCheck) {
        // Rate limit dépassé
        return notFound();
      }
    }

    // 3. Configuration adaptative selon les performances réseau
    const adaptiveConfig = getAdaptiveSiteConfig();

    console.log('Starting to get data');

    // 4. Récupération des données avec toutes les optimisations
    const applicationData = await getOptimizedSingleApplication(
      applicationId,
      templateId,
    );

    // 5. Vérifications des résultats - Application inexistante
    if (
      !applicationData ||
      !applicationData.application ||
      applicationData.metadata?.applicationExists === false
    ) {
      captureMessage('Single application page: Application not found', {
        level: 'info',
        tags: {
          component: 'single_application_page',
          issue_type: 'application_not_found',
        },
        extra: {
          applicationId,
          templateId,
          adaptiveConfig: adaptiveConfig.networkInfo,
        },
      });

      return notFound();
    }

    // 6. Vérification de la cohérence template/application
    if (applicationData.metadata?.templateMatch === false) {
      captureMessage('Single application page: Template mismatch', {
        level: 'warning',
        tags: {
          component: 'single_application_page',
          issue_type: 'template_mismatch',
        },
        extra: {
          applicationId,
          templateId,
          errorMessage: applicationData.metadata.errorMessage,
        },
      });

      return notFound();
    }

    // 7. Vérification des erreurs de données
    if (applicationData.metadata?.error) {
      captureMessage('Single application page: Data error', {
        level: 'error',
        tags: {
          component: 'single_application_page',
          issue_type: 'data_error',
        },
        extra: {
          applicationId,
          templateId,
          errorMessage: applicationData.metadata.errorMessage,
        },
      });

      return notFound();
    }

    // 8. Métriques de performance
    const totalDuration = performance.now() - requestStartTime;

    if (totalDuration > 4000) {
      // Plus de 4 secondes pour page d'application (plus complexe)
      captureMessage('Slow single application page load', {
        level: 'warning',
        tags: {
          component: 'single_application_page',
          performance_issue: 'slow_page_load',
        },
        extra: {
          applicationId,
          templateId,
          totalDuration,
          queryDuration: applicationData.metadata?.queryDuration,
          relatedAppsCount: applicationData.relatedApplications?.length,
          fromCache: applicationData.metadata?.fromCache,
          networkInfo: adaptiveConfig.networkInfo,
        },
      });
    }

    // 9. Log de succès en développement
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Single Application Page] Loaded successfully:`, {
        applicationId,
        templateId,
        applicationName: applicationData.application?.application_name,
        templateName: applicationData.template?.template_name,
        relatedAppsCount: applicationData.relatedApplications?.length || 0,
        platformsCount: applicationData.platforms?.length || 0,
        totalDuration: `${totalDuration.toFixed(2)}ms`,
        fromCache: applicationData.metadata?.fromCache,
      });
    }

    // 10. Retourner le composant avec les données enrichies
    return (
      <Suspense fallback={<SingleApplicationPageSkeleton />}>
        <SingleApplication
          application={applicationData.application}
          template={applicationData.template}
          relatedApplications={applicationData.relatedApplications}
          platforms={applicationData.platforms}
          adaptiveConfig={adaptiveConfig}
          performanceMetrics={{
            loadTime: totalDuration,
            fromCache: applicationData.metadata?.fromCache,
            queryDuration: applicationData.metadata?.queryDuration,
          }}
          context={{
            templateId,
            applicationId,
            stats: {
              application: applicationData.metadata?.applicationStats,
              template: applicationData.metadata?.templateStats,
            },
          }}
        />
      </Suspense>
    );
  } catch (error) {
    const errorDuration = performance.now() - requestStartTime;

    captureException(error, {
      tags: {
        component: 'single_application_page',
        error_type: 'page_render_error',
      },
      extra: {
        rawAppId,
        rawTemplateId,
        duration: errorDuration,
      },
    });

    // Log en développement
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Single Application Page] Error:', error);
    }

    // Fallback gracieux
    return (
      <div className="single-application-error-fallback">
        <h1>Application temporairement indisponible</h1>
        <p>
          L&apos;application que vous recherchez n&apos;est pas disponible pour
          le moment.
        </p>
        <p>Veuillez réessayer dans quelques instants.</p>
      </div>
    );
  }
}

// =============================
// COMPOSANT DE LOADING SKELETON
// =============================

function SingleApplicationPageSkeleton() {
  return (
    <div className="single-application-page-skeleton">
      <div className="breadcrumb-skeleton">
        <div className="skeleton-text-small"></div>
        <div className="skeleton-text-small"></div>
        <div className="skeleton-text-small"></div>
      </div>

      <div className="application-header-skeleton">
        <div className="application-images-skeleton">
          <div className="skeleton-image-large"></div>
          <div className="thumbnail-grid-skeleton">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skeleton-image-small"></div>
            ))}
          </div>
        </div>

        <div className="application-info-skeleton">
          <div className="skeleton-title-large"></div>
          <div className="skeleton-text"></div>
          <div className="skeleton-text"></div>
          <div className="skeleton-price-large"></div>
          <div className="skeleton-buttons">
            <div className="skeleton-button-primary"></div>
            <div className="skeleton-button-secondary"></div>
          </div>
        </div>
      </div>

      <div className="application-details-skeleton">
        <div className="skeleton-title"></div>
        <div className="skeleton-text-block"></div>
        <div className="skeleton-text-block"></div>
      </div>

      <div className="related-applications-skeleton">
        <div className="skeleton-title"></div>
        <div className="related-apps-grid-skeleton">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="related-app-card-skeleton">
              <div className="skeleton-image"></div>
              <div className="skeleton-content">
                <div className="skeleton-text"></div>
                <div className="skeleton-price"></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="platforms-skeleton">
        <div className="skeleton-title"></div>
        <div className="platforms-list-skeleton">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="platform-item-skeleton">
              <div className="skeleton-icon"></div>
              <div className="skeleton-text"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================
// CONFIGURATION DES METADATA
// =============================

export async function generateMetadata({ params }) {
  const { id: rawTemplateId, appID: rawAppId } = await params;

  try {
    // Validation rapide pour metadata
    const validationResult = await validateApplicationAndTemplateIds(
      rawAppId,
      rawTemplateId,
    );
    if (!validationResult.isValid) {
      return {
        title: 'Application non trouvée - Benew',
        description:
          "L'application demandée n'existe pas ou n'est plus disponible.",
      };
    }

    const { applicationId, templateId } = validationResult;

    // Essayer de récupérer depuis le cache pour les metadata
    const cacheKey = generateCacheKey('single_application', {
      applicationId,
      templateId,
    });
    const cachedData = await projectCache.singleApplication.get(cacheKey);

    if (cachedData && cachedData.application && cachedData.template) {
      const app = cachedData.application;
      const template = cachedData.template;

      return {
        title: `${app.application_name} - ${template.template_name} - Benew`,
        description:
          app.application_description ||
          `Découvrez l'application ${app.application_name} du template ${template.template_name} sur Benew.`,
        robots: {
          index: true,
          follow: true,
        },
        alternates: {
          canonical: `/templates/${templateId}/applications/${applicationId}`,
        },
        openGraph: {
          title: `${app.application_name} - ${template.template_name} - Benew`,
          description:
            app.application_description ||
            `Application ${app.application_name} du template ${template.template_name}.`,
          images:
            app.application_images?.length > 0
              ? [app.application_images[0]]
              : template.template_image
                ? [template.template_image]
                : [],
          type: 'website',
        },
        other: {
          'application:category': app.application_category,
          'application:level': app.application_level?.toString(),
          'application:fee': app.application_fee?.toString(),
        },
      };
    }

    // Fallback metadata si pas de cache
    return {
      title: 'Application Benew',
      description: 'Découvrez cette application sur Benew.',
      robots: {
        index: true,
        follow: true,
      },
      alternates: {
        canonical: `/templates/${templateId}/applications/${applicationId}`,
      },
    };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_application_metadata',
        error_type: 'metadata_generation_error',
      },
      extra: { rawAppId, rawTemplateId },
    });

    return {
      title: 'Application - Benew',
      description: 'Application Benew',
    };
  }
}

// =============================
// UTILITAIRES D'INVALIDATION
// =============================

/**
 * Fonction pour invalider le cache d'une application spécifique
 * @param {string} applicationId - ID de l'application à invalider
 * @param {string} templateId - ID du template (optionnel pour validation)
 */
export async function invalidateSingleApplicationCache(
  applicationId,
  templateId = null,
) {
  try {
    // Valider l'ID de l'application
    const appValidation = await applicationIdSchema.validate({
      id: applicationId,
    });
    if (!appValidation) {
      throw new Error(
        `Invalid application ID for cache invalidation: ${applicationId}`,
      );
    }

    // Valider l'ID du template si fourni
    if (templateId) {
      const templateValidation = await templateIdSchema.validate({
        id: templateId,
      });
      if (!templateValidation) {
        throw new Error(
          `Invalid template ID for cache invalidation: ${templateId}`,
        );
      }
    }

    const validApplicationId = appValidation.id;
    const invalidatedCount = invalidateProjectCache(
      'single_application',
      validApplicationId,
    );

    captureMessage('Single application cache invalidated', {
      level: 'info',
      tags: {
        component: 'single_application_page',
        action: 'cache_invalidation',
      },
      extra: {
        applicationId: validApplicationId,
        templateId,
        invalidatedCount,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      applicationId: validApplicationId,
      templateId,
      invalidatedCount,
    };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_application_page',
        action: 'cache_invalidation_error',
      },
      extra: { applicationId, templateId },
    });

    return { success: false, error: error.message };
  }
}

/**
 * Fonction pour invalider le cache de toutes les applications d'un template
 * @param {string} templateId - ID du template
 */
export async function invalidateTemplateApplicationsCache(templateId) {
  try {
    const validationResult = await templateIdSchema.validate({
      id: templateId,
    });
    if (!validationResult) {
      throw new Error(`Invalid template ID: ${templateId}`);
    }

    // Invalider le cache des applications individuelles et du template
    const applicationInvalidated = invalidateProjectCache(
      'single_application',
      validationResult.id,
    );
    const templateInvalidated = invalidateProjectCache(
      'single_template',
      validationResult.id,
    );
    const applicationsListInvalidated = invalidateProjectCache(
      'application',
      validationResult.id,
    );

    const totalInvalidated =
      applicationInvalidated +
      templateInvalidated +
      applicationsListInvalidated;

    captureMessage('Template applications cache invalidated', {
      level: 'info',
      tags: {
        component: 'single_application_page',
        action: 'template_applications_cache_invalidation',
      },
      extra: {
        templateId: validationResult.id,
        totalInvalidated,
        applicationInvalidated,
        templateInvalidated,
        applicationsListInvalidated,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      templateId: validationResult.id,
      totalInvalidated,
      breakdown: {
        applications: applicationInvalidated,
        template: templateInvalidated,
        applicationsList: applicationsListInvalidated,
      },
    };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_application_page',
        action: 'template_applications_cache_invalidation_error',
      },
      extra: { templateId },
    });

    return { success: false, error: error.message };
  }
}

/**
 * Fonction pour invalider le cache des applications liées (suggestions)
 * @param {string} applicationId - ID de l'application
 * @param {string} templateId - ID du template
 */
export async function invalidateRelatedApplicationsCache(
  applicationId,
  templateId,
) {
  try {
    const validationResult = await validateApplicationAndTemplateIds(
      applicationId,
      templateId,
    );
    if (!validationResult.isValid) {
      throw new Error(`Invalid IDs: ${validationResult.error}`);
    }

    // Invalider le cache de l'application principale et des applications liées du template
    const mainAppInvalidated = invalidateProjectCache(
      'single_application',
      validationResult.applicationId,
    );
    const relatedAppsInvalidated = invalidateProjectCache(
      'application',
      validationResult.templateId,
    );

    const totalInvalidated = mainAppInvalidated + relatedAppsInvalidated;

    captureMessage('Related applications cache invalidated', {
      level: 'info',
      tags: {
        component: 'single_application_page',
        action: 'related_applications_cache_invalidation',
      },
      extra: {
        applicationId: validationResult.applicationId,
        templateId: validationResult.templateId,
        totalInvalidated,
        mainAppInvalidated,
        relatedAppsInvalidated,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      applicationId: validationResult.applicationId,
      templateId: validationResult.templateId,
      totalInvalidated,
      breakdown: {
        mainApplication: mainAppInvalidated,
        relatedApplications: relatedAppsInvalidated,
      },
    };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_application_page',
        action: 'related_applications_cache_invalidation_error',
      },
      extra: { applicationId, templateId },
    });

    return { success: false, error: error.message };
  }
}

// =============================
// MONITORING ET DIAGNOSTICS
// =============================

/**
 * Fonction de diagnostic pour le monitoring (développement)
 */
export async function getSingleApplicationPageDiagnostics(
  applicationId,
  templateId,
) {
  if (process.env.NODE_ENV === 'production') {
    return { error: 'Diagnostics not available in production' };
  }

  try {
    // Valider les IDs
    const validationResult = await validateApplicationAndTemplateIds(
      applicationId,
      templateId,
    );
    if (!validationResult.isValid) {
      return {
        error: 'Invalid IDs',
        validationError: validationResult.error,
      };
    }

    const { applicationId: validAppId, templateId: validTemplateId } =
      validationResult;

    const [cacheStats, performanceStats, dbHealth] = await Promise.all([
      projectCache.singleApplication.getStats(),
      getSitePerformanceStats(),
      monitoring.getHealth(),
    ]);

    // Vérifier le cache spécifique
    const cacheKey = generateCacheKey('single_application', {
      applicationId: validAppId,
      templateId: validTemplateId,
    });
    const cachedData = await projectCache.singleApplication.get(cacheKey);

    return {
      applicationId: validAppId,
      templateId: validTemplateId,
      validation: validationResult,
      cache: {
        ...cacheStats,
        specificApplication: {
          cached: !!cachedData,
          cacheKey: cacheKey.substring(0, 50),
          data: cachedData
            ? {
                application: !!cachedData.application,
                template: !!cachedData.template,
                relatedAppsCount: cachedData.relatedApplications?.length || 0,
                platformsCount: cachedData.platforms?.length || 0,
                fromCache: cachedData.metadata?.fromCache,
                timestamp: cachedData.metadata?.timestamp,
                stats: {
                  application: cachedData.metadata?.applicationStats,
                  template: cachedData.metadata?.templateStats,
                },
              }
            : null,
        },
      },
      performance: performanceStats,
      database: dbHealth,
      config: SINGLE_APPLICATION_CONFIG,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Fonction pour obtenir les statistiques d'usage d'une application
 * @param {string} applicationId - ID de l'application
 * @param {string} templateId - ID du template
 */
export async function getApplicationUsageStats(applicationId, templateId) {
  if (process.env.NODE_ENV === 'production') {
    return { error: 'Usage stats not available in production' };
  }

  try {
    const validationResult = await validateApplicationAndTemplateIds(
      applicationId,
      templateId,
    );
    if (!validationResult.isValid) {
      return { error: 'Invalid IDs', validationError: validationResult.error };
    }

    const { applicationId: validAppId, templateId: validTemplateId } =
      validationResult;

    // Simuler des statistiques d'usage (en production, ces données viendraient d'analytics)
    const stats = {
      applicationId: validAppId,
      templateId: validTemplateId,
      views: {
        today: Math.floor(Math.random() * 100),
        thisWeek: Math.floor(Math.random() * 500),
        thisMonth: Math.floor(Math.random() * 2000),
      },
      cacheHitRate: {
        application: Math.random() * 100,
        template: Math.random() * 100,
      },
      performanceMetrics: {
        averageLoadTime: Math.random() * 1000 + 500,
        slowestLoadTime: Math.random() * 2000 + 1000,
        fastestLoadTime: Math.random() * 300 + 100,
      },
      relatedApplicationsViews: Math.floor(Math.random() * 200),
      timestamp: new Date().toISOString(),
    };

    captureMessage('Application usage stats generated', {
      level: 'debug',
      tags: {
        component: 'single_application_page',
        action: 'usage_stats',
      },
      extra: stats,
    });

    return stats;
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_application_page',
        action: 'usage_stats_error',
      },
      extra: { applicationId, templateId },
    });

    return { error: error.message };
  }
}

// =============================
// GENERATION STATIQUE (OPTIONNEL)
// =============================

/**
 * Fonction pour générer des paramètres statiques (si nécessaire)
 * Utile pour pré-générer les pages les plus populaires
 */
// export async function generateStaticParams() {
//   let results = [];
//   // En production, on pourrait récupérer les applications les plus populaires
//   // pour les pré-générer statiquement
//   if (process.env.NODE_ENV !== 'production') {
//     return results;
//   }

//   try {
//     // Cette fonction pourrait récupérer les top applications depuis la DB
//     // const popularApps = await getPopularApplications();
//     // return popularApps.map(app => ({
//     //   id: app.template_id,
//     //   appID: app.application_id
//     // }));
//     // return [];
//   } catch (error) {
//     captureException(error, {
//       tags: {
//         component: 'single_application_page',
//         action: 'generate_static_params_error',
//       },
//     });

//     results = [];
//   }

//   return results;
// }

export default SingleApplicationPage;
