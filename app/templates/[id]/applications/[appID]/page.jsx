// app/templates/[id]/applications/[appID]/page.jsx
// Server Component optimisé pour une application spécifique
// Next.js 15 + PostgreSQL + Cache + Monitoring essentiel

import { Suspense } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import SingleApplication from '@/components/templates/SingleApplication';
import { getClient } from '@/backend/dbConnect';
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
} from '../../../../../instrumentation';
import { optimizeApiCall, getAdaptiveSiteConfig } from '@/utils/performance';
import { limitBenewAPI } from '@/backend/rateLimiter';
import { applicationIdSchema, templateIdSchema } from '@/utils/schemas/schema';

// Configuration simplifiée
const CONFIG = {
  cache: { ttl: 20 * 60 * 1000, entityType: 'single_application' },
  database: { timeout: 12000, retryAttempts: 3, retryDelay: 2000 },
  performance: { slowQueryThreshold: 1800, alertThreshold: 3500 },
  rateLimiting: { enabled: true, preset: 'TEMPLATES_API' },
  validation: {
    strictMode: true,
    sanitizeInputs: true,
    validateTemplateContext: true,
  },
};

// Validation et sanitisation des IDs
async function validateApplicationAndTemplateIds(appId, templateId) {
  const startTime = performance.now();

  try {
    const [appValidation, templateValidation] = await Promise.all([
      applicationIdSchema.validate(
        { id: appId },
        {
          strict: CONFIG.validation.strictMode,
          stripUnknown: true,
        },
      ),
      templateIdSchema.validate(
        { id: templateId },
        {
          strict: CONFIG.validation.strictMode,
          stripUnknown: true,
        },
      ),
    ]);

    return {
      isValid: true,
      applicationId: appValidation.id,
      templateId: templateValidation.id,
      validationDuration: performance.now() - startTime,
    };
  } catch (validationError) {
    const validationDuration = performance.now() - startTime;

    captureValidationError(validationError, {
      inputData: { appId, templateId },
      schema: 'applicationIdSchema + templateIdSchema',
      tags: { component: 'single_application_page', validation_failed: true },
      extra: { rawAppId: appId, rawTemplateId: templateId, validationDuration },
    });

    return {
      isValid: false,
      error: validationError.message,
      validationDuration,
    };
  }
}

// Requêtes optimisées
function getApplicationDataQuery(applicationId, templateId) {
  return {
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
          a.application_level,
          a.sales_count as application_sales,
          
          -- Données du template parent
          t.template_id,
          t.template_name,
          
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

// Fonction principale de récupération
async function getSingleApplicationWithOptimizations(
  applicationId,
  templateId,
) {
  const startTime = performance.now();
  const cacheKey = generateCacheKey('single_application', {
    applicationId,
    templateId,
  });

  try {
    // Vérifier le cache
    const cachedResult = await projectCache.singleApplication.get(cacheKey);
    if (cachedResult) {
      return {
        ...cachedResult,
        metadata: { ...cachedResult.metadata, fromCache: true },
      };
    }

    // Récupération depuis la DB
    const client = await getClient();
    let applicationData = null;

    try {
      const queries = getApplicationDataQuery(applicationId, templateId);
      const queryStartTime = performance.now();

      // Exécuter toutes les requêtes en parallèle
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

      // Vérifier l'existence
      if (existenceResult.rows.length === 0) {
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

      const mainData = applicationResult.rows[0];
      const relatedApplications = relatedAppsResult.rows;
      const platforms = platformsResult.rows;

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
        template_web_applications: mainData.template_web_applications,
        template_mobile_applications: mainData.template_mobile_applications,
      };

      // Log seulement si lent
      if (queryDuration > CONFIG.performance.slowQueryThreshold) {
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
      if (queryDuration > CONFIG.performance.alertThreshold) {
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
            threshold: CONFIG.performance.alertThreshold,
          },
        });
      }

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
          applicationStats: {
            level: application.application_level,
            category: application.application_category,
            salesCount: application.application_sales,
            hasAdminLink: !!application.application_admin_link,
            imagesCount: application.application_images?.length || 0,
          },
          templateStats: {
            totalApplications: template.template_total_applications,
            webApplications: template.template_web_applications,
            mobileApplications: template.template_mobile_applications,
          },
        },
      };

      // Mettre en cache
      await projectCache.singleApplication.set(cacheKey, applicationData, {
        ttl: CONFIG.cache.ttl,
      });

      return applicationData;
    } finally {
      client.release();
    }
  } catch (error) {
    const errorDuration = performance.now() - startTime;

    if (/postgres|pg|database|db|connection/i.test(error.message)) {
      captureDatabaseError(error, {
        table: 'catalog.applications, catalog.templates, admin.platforms',
        operation: 'select_single_application_with_context',
        tags: { component: 'single_application_page' },
        extra: { applicationId, templateId, duration: errorDuration },
      });
    } else {
      captureException(error, {
        tags: {
          component: 'single_application_page',
          error_type: 'single_application_fetch_error',
        },
        extra: { applicationId, templateId, duration: errorDuration },
      });
    }

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

// Version optimisée avec performance
const getOptimizedSingleApplication = optimizeApiCall(
  getSingleApplicationWithOptimizations,
  {
    entityType: 'single_application',
    cacheTTL: CONFIG.cache.ttl,
    throttleDelay: 150,
    retryAttempts: CONFIG.database.retryAttempts,
    retryDelay: CONFIG.database.retryDelay,
  },
);

// Composant principal
async function SingleApplicationPage({ params }) {
  const requestStartTime = performance.now();
  const { id: rawTemplateId, appID: rawAppId } = await params;

  try {
    // Validation stricte des IDs
    const validationResult = await validateApplicationAndTemplateIds(
      rawAppId,
      rawTemplateId,
    );

    if (!validationResult.isValid) {
      return notFound();
    }

    const { applicationId, templateId } = validationResult;

    // Rate Limiting
    if (CONFIG.rateLimiting.enabled) {
      const headersList = await headers();
      const rateLimitCheck = await limitBenewAPI('templates')({
        headers: headersList,
        url: `/templates/${templateId}/applications/${applicationId}`,
        method: 'GET',
      });

      if (rateLimitCheck) {
        return notFound();
      }
    }

    const adaptiveConfig = getAdaptiveSiteConfig();
    const applicationData = await getOptimizedSingleApplication(
      applicationId,
      templateId,
    );

    // Vérifications des résultats
    if (
      !applicationData ||
      !applicationData.application ||
      applicationData.metadata?.applicationExists === false
    ) {
      return notFound();
    }

    if (applicationData.metadata?.templateMatch === false) {
      return notFound();
    }

    if (applicationData.metadata?.error) {
      return notFound();
    }

    const totalDuration = performance.now() - requestStartTime;

    // Log seulement si très lent
    if (totalDuration > 4000) {
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
        },
      });
    }

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
            relatedAppsCount: applicationData.relatedApplications?.length || 0,
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
    captureException(error, {
      tags: {
        component: 'single_application_page',
        error_type: 'page_render_error',
      },
      extra: {
        rawAppId,
        rawTemplateId,
        duration: performance.now() - requestStartTime,
      },
    });

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

// Skeleton component
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

// Metadata dynamique
export async function generateMetadata({ params }) {
  const { id: rawTemplateId, appID: rawAppId } = await params;

  try {
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
        robots: { index: true, follow: true },
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

    return {
      title: 'Application Benew',
      description: 'Découvrez cette application sur Benew.',
      robots: { index: true, follow: true },
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

// Utilitaires d'invalidation
export async function invalidateSingleApplicationCache(
  applicationId,
  templateId = null,
) {
  try {
    const appValidation = await applicationIdSchema.validate({
      id: applicationId,
    });
    if (!appValidation) {
      throw new Error(
        `Invalid application ID for cache invalidation: ${applicationId}`,
      );
    }

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

export async function invalidateTemplateApplicationsCache(templateId) {
  try {
    const validationResult = await templateIdSchema.validate({
      id: templateId,
    });
    if (!validationResult) {
      throw new Error(`Invalid template ID: ${templateId}`);
    }

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

// Statistiques simplifiées
export async function getSingleApplicationStats(applicationId, templateId) {
  try {
    const validationResult = await validateApplicationAndTemplateIds(
      applicationId,
      templateId,
    );
    if (!validationResult.isValid) {
      throw new Error(`Invalid IDs: ${validationResult.error}`);
    }

    const { applicationId: validAppId, templateId: validTemplateId } =
      validationResult;
    const cacheKey = generateCacheKey('single_application_stats', {
      applicationId: validAppId,
      templateId: validTemplateId,
    });
    const cachedStats = await projectCache.singleApplication.get(
      `${cacheKey}_stats`,
    );

    if (cachedStats) {
      return cachedStats;
    }

    const client = await getClient();
    try {
      const statsQuery = `
        SELECT 
          a.application_id,
          a.application_name,
          a.application_category,
          a.application_level,
          a.application_fee,
          a.application_rent,
          a.sales_count,
          t.template_id,
          t.template_name,
          (SELECT COUNT(*) FROM catalog.applications WHERE application_template_id = t.template_id AND is_active = true) as template_total_apps,
          (SELECT AVG(application_fee) FROM catalog.applications WHERE application_template_id = t.template_id AND is_active = true) as template_avg_fee,
          (SELECT AVG(sales_count) FROM catalog.applications WHERE application_template_id = t.template_id AND is_active = true) as template_avg_sales
        FROM catalog.applications a
        JOIN catalog.templates t ON a.application_template_id = t.template_id
        WHERE a.application_id = $1 AND t.template_id = $2 AND a.is_active = true AND t.is_active = true
      `;

      const result = await client.query(statsQuery, [
        validAppId,
        validTemplateId,
      ]);
      const stats = result.rows[0];

      if (!stats) {
        return {
          error: 'Application not found',
          applicationId: validAppId,
          templateId: validTemplateId,
          timestamp: new Date().toISOString(),
        };
      }

      const enrichedStats = {
        ...stats,
        sales_count: parseInt(stats.sales_count) || 0,
        template_total_apps: parseInt(stats.template_total_apps) || 0,
        template_avg_fee: parseFloat(stats.template_avg_fee) || 0,
        template_avg_sales: parseFloat(stats.template_avg_sales) || 0,
        performance_vs_template: {
          fee_ratio:
            stats.template_avg_fee > 0
              ? (stats.application_fee / stats.template_avg_fee).toFixed(3)
              : 0,
          sales_ratio:
            stats.template_avg_sales > 0
              ? (stats.sales_count / stats.template_avg_sales).toFixed(3)
              : 0,
        },
        timestamp: new Date().toISOString(),
      };

      await projectCache.singleApplication.set(
        `${cacheKey}_stats`,
        enrichedStats,
        {
          ttl: 10 * 60 * 1000,
        },
      );

      return enrichedStats;
    } finally {
      client.release();
    }
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_application_page',
        action: 'get_application_stats_error',
      },
      extra: { applicationId, templateId },
    });

    return {
      error: error.message,
      applicationId,
      templateId,
      timestamp: new Date().toISOString(),
    };
  }
}

export default SingleApplicationPage;
