// app/templates/[id]/page.jsx
// Server Component optimisé pour un template spécifique
// Next.js 15 + PostgreSQL + Cache + Monitoring essentiel

import { Suspense } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import SingleTemplateShops from '@/components/templates/SingleTemplateShops';
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
} from '../../../instrumentation';
import { optimizeApiCall, getAdaptiveSiteConfig } from '@/utils/performance';
import { limitBenewAPI } from '@/backend/rateLimiter';
import { templateIdSchema } from '@/utils/schemas/schema';

// Configuration simplifiée
const CONFIG = {
  cache: { ttl: 15 * 60 * 1000, entityType: 'single_template' },
  database: { timeout: 10000, retryAttempts: 3, retryDelay: 1500 },
  performance: { slowQueryThreshold: 1500, alertThreshold: 3000 },
  rateLimiting: { enabled: true, preset: 'TEMPLATES_API' },
  validation: { strictMode: true, sanitizeInputs: true },
};

// Validation et sanitisation de l'ID
async function validateTemplateId(id) {
  const startTime = performance.now();

  try {
    const validatedData = await templateIdSchema.validate(
      { id },
      {
        strict: CONFIG.validation.strictMode,
        stripUnknown: true,
      },
    );

    return {
      isValid: true,
      templateId: validatedData.id,
      validationDuration: performance.now() - startTime,
    };
  } catch (validationError) {
    const validationDuration = performance.now() - startTime;

    captureValidationError(validationError, {
      inputData: { id },
      schema: 'templateIdSchema',
      tags: { component: 'single_template_page', validation_failed: true },
      extra: { rawId: id, validationDuration },
    });

    return {
      isValid: false,
      error: validationError.message,
      validationDuration,
    };
  }
}

// Requêtes optimisées
function getTemplateDataQuery(templateId) {
  return {
    applicationsQuery: {
      query: `
        SELECT 
          a.application_id, 
          a.application_name, 
          a.application_category, 
          a.application_fee, 
          a.application_rent, 
          a.application_images, 
          a.application_level,
          t.template_id, 
          t.template_name
        FROM catalog.applications a
        JOIN catalog.templates t ON a.application_template_id = t.template_id 
        WHERE a.application_template_id = $1 
          AND a.is_active = true 
          AND t.is_active = true
        ORDER BY a.application_level ASC, a.created_at DESC
      `,
      params: [templateId],
    },

    platformsQuery: {
      query: `
        SELECT 
          platform_id, 
          platform_name, 
          platform_number, 
          is_active
        FROM admin.platforms
        WHERE is_active = true
        ORDER BY platform_name ASC
      `,
      params: [],
    },

    templateExistsQuery: {
      query: `
        SELECT 
          template_id,
          template_name,
          template_image,
          template_has_web,
          template_has_mobile,
          template_added
        FROM catalog.templates 
        WHERE template_id = $1 AND is_active = true
      `,
      params: [templateId],
    },
  };
}

// Fonction principale de récupération
async function getSingleTemplateWithOptimizations(templateId) {
  const startTime = performance.now();
  const cacheKey = generateCacheKey('single_template', { templateId });

  try {
    // Vérifier le cache
    const cachedResult = await projectCache.singleTemplate.get(cacheKey);
    if (cachedResult) {
      return {
        ...cachedResult,
        metadata: { ...cachedResult.metadata, fromCache: true },
      };
    }

    // Récupération depuis la DB
    const client = await getClient();
    let templateData = null;

    try {
      const queries = getTemplateDataQuery(templateId);
      const queryStartTime = performance.now();

      // Exécuter toutes les requêtes en parallèle
      const [templateExistsResult, applicationsResult, platformsResult] =
        await Promise.all([
          client.query(
            queries.templateExistsQuery.query,
            queries.templateExistsQuery.params,
          ),
          client.query(
            queries.applicationsQuery.query,
            queries.applicationsQuery.params,
          ),
          client.query(
            queries.platformsQuery.query,
            queries.platformsQuery.params,
          ),
        ]);

      const queryDuration = performance.now() - queryStartTime;

      // Vérifier si le template existe
      if (templateExistsResult.rows.length === 0) {
        return {
          template: null,
          applications: [],
          platforms: [],
          metadata: {
            queryDuration,
            fromCache: false,
            timestamp: new Date().toISOString(),
            resultCount: 0,
            templateExists: false,
          },
        };
      }

      const templateInfo = templateExistsResult.rows[0];
      const applications = applicationsResult.rows;
      const platforms = platformsResult.rows;

      // Log seulement si lent
      if (queryDuration > CONFIG.performance.slowQueryThreshold) {
        captureMessage('Slow single template query detected', {
          level: 'warning',
          tags: {
            component: 'single_template_page',
            performance_issue: 'slow_query',
          },
          extra: {
            templateId,
            duration: queryDuration,
            applicationsCount: applications.length,
            platformsCount: platforms.length,
          },
        });
      }

      // Alerte pour requêtes très lentes
      if (queryDuration > CONFIG.performance.alertThreshold) {
        captureMessage('Critical: Very slow single template query', {
          level: 'error',
          tags: {
            component: 'single_template_page',
            performance_issue: 'critical_slow_query',
          },
          extra: {
            templateId,
            duration: queryDuration,
            threshold: CONFIG.performance.alertThreshold,
          },
        });
      }

      templateData = {
        template: templateInfo,
        applications,
        platforms,
        metadata: {
          queryDuration,
          fromCache: false,
          timestamp: new Date().toISOString(),
          resultCount: applications.length,
          templateExists: true,
          templateId,
          applicationsByLevel: applications.reduce((acc, app) => {
            acc[app.application_level] = (acc[app.application_level] || 0) + 1;
            return acc;
          }, {}),
        },
      };

      // Mettre en cache
      await projectCache.singleTemplate.set(cacheKey, templateData, {
        ttl: CONFIG.cache.ttl,
      });

      return templateData;
    } finally {
      client.release();
    }
  } catch (error) {
    const errorDuration = performance.now() - startTime;

    if (/postgres|pg|database|db|connection/i.test(error.message)) {
      captureDatabaseError(error, {
        table: 'catalog.templates, catalog.applications, admin.platforms',
        operation: 'select_single_template_with_applications',
        tags: { component: 'single_template_page' },
        extra: { templateId, duration: errorDuration },
      });
    } else {
      captureException(error, {
        tags: {
          component: 'single_template_page',
          error_type: 'single_template_fetch_error',
        },
        extra: { templateId, duration: errorDuration },
      });
    }

    return {
      template: null,
      applications: [],
      platforms: [],
      metadata: {
        queryDuration: errorDuration,
        fromCache: false,
        timestamp: new Date().toISOString(),
        resultCount: 0,
        templateExists: false,
        error: true,
        errorMessage: 'Failed to load template data',
      },
    };
  }
}

// Version optimisée avec performance
const getOptimizedSingleTemplate = optimizeApiCall(
  getSingleTemplateWithOptimizations,
  {
    entityType: 'single_template',
    cacheTTL: CONFIG.cache.ttl,
    throttleDelay: 200,
    retryAttempts: CONFIG.database.retryAttempts,
    retryDelay: CONFIG.database.retryDelay,
  },
);

// Composant principal
async function SingleTemplatePage({ params }) {
  const requestStartTime = performance.now();
  const { id: rawId } = await params;

  try {
    // Validation stricte de l'ID
    const validationResult = await validateTemplateId(rawId);

    if (!validationResult.isValid) {
      return notFound();
    }

    const templateId = validationResult.templateId;

    // Rate Limiting
    if (CONFIG.rateLimiting.enabled) {
      const headersList = headers();
      const rateLimitCheck = await limitBenewAPI('templates')({
        headers: headersList,
        url: `/templates/${templateId}`,
        method: 'GET',
      });

      if (rateLimitCheck) {
        return notFound();
      }
    }

    const adaptiveConfig = getAdaptiveSiteConfig();
    const templateData = await getOptimizedSingleTemplate(templateId);

    // Vérification des résultats
    if (
      !templateData ||
      !templateData.template ||
      templateData.metadata?.templateExists === false
    ) {
      return notFound();
    }

    if (templateData.metadata?.error) {
      return notFound();
    }

    const totalDuration = performance.now() - requestStartTime;

    // Log seulement si très lent
    if (totalDuration > 3000) {
      captureMessage('Slow single template page load', {
        level: 'warning',
        tags: {
          component: 'single_template_page',
          performance_issue: 'slow_page_load',
        },
        extra: {
          templateId,
          totalDuration,
          queryDuration: templateData.metadata?.queryDuration,
          applicationsCount: templateData.applications?.length,
          fromCache: templateData.metadata?.fromCache,
        },
      });
    }

    return (
      <Suspense fallback={<SingleTemplatePageSkeleton />}>
        <SingleTemplateShops
          templateID={templateId}
          applications={templateData.applications}
          platforms={templateData.platforms}
          adaptiveConfig={adaptiveConfig}
          performanceMetrics={{
            loadTime: totalDuration,
            fromCache: templateData.metadata?.fromCache,
            queryDuration: templateData.metadata?.queryDuration,
            applicationsCount: templateData.applications?.length || 0,
          }}
        />
      </Suspense>
    );
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_template_page',
        error_type: 'page_render_error',
      },
      extra: { rawId, duration: performance.now() - requestStartTime },
    });

    return (
      <div className="single-template-error-fallback">
        <h1>Template temporairement indisponible</h1>
        <p>
          Le template que vous recherchez n&apos;est pas disponible pour le
          moment.
        </p>
        <p>Veuillez réessayer dans quelques instants.</p>
      </div>
    );
  }
}

// Skeleton component
function SingleTemplatePageSkeleton() {
  return (
    <div className="single-template-page-skeleton">
      <div className="template-header-skeleton">
        <div className="skeleton-image-large"></div>
        <div className="skeleton-content">
          <div className="skeleton-title-large"></div>
          <div className="skeleton-text"></div>
          <div className="skeleton-text"></div>
        </div>
      </div>
      <div className="applications-grid-skeleton">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="application-card-skeleton">
            <div className="skeleton-image"></div>
            <div className="skeleton-content">
              <div className="skeleton-text"></div>
              <div className="skeleton-text"></div>
              <div className="skeleton-price"></div>
            </div>
          </div>
        ))}
      </div>
      <div className="platforms-skeleton">
        <div className="skeleton-title"></div>
        <div className="platforms-list-skeleton">
          {Array.from({ length: 4 }, (_, i) => (
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

// Metadata
export const metadata = {
  title: 'One Template Benew | Application Web & Mobile',
  description:
    'Découvrez ce template premium et ses applications disponibles. Solutions professionnelles pour votre business en ligne avec support web et mobile.',
  keywords: [
    'template premium',
    'application web',
    'application mobile',
    'solution digitale',
    'développement',
    'Benew',
    'Djibouti',
  ],
  openGraph: {
    title: 'Template Premium Benew - Applications Disponibles',
    description:
      'Explorez ce template et ses applications web et mobile. Designs professionnels et fonctionnalités avancées.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/templates/[id]`,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Template Premium Benew',
    description:
      'Template professionnel avec applications web et mobile disponibles.',
  },
  other: {
    'application-name': 'Benew Template',
    'theme-color': '#f6a037',
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/templates`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

// Utilitaires d'invalidation
export async function invalidateSingleTemplateCache(templateId) {
  try {
    const validationResult = await validateTemplateId(templateId);
    if (!validationResult.isValid) {
      throw new Error(
        `Invalid template ID for cache invalidation: ${templateId}`,
      );
    }

    const validTemplateId = validationResult.templateId;
    const invalidatedCount = invalidateProjectCache(
      'single_template',
      validTemplateId,
    );

    return { success: true, templateId: validTemplateId, invalidatedCount };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_template_page',
        action: 'cache_invalidation_error',
      },
      extra: { templateId },
    });

    return { success: false, error: error.message };
  }
}

export async function invalidateTemplateApplicationsCache(templateId) {
  try {
    const validationResult = await validateTemplateId(templateId);
    if (!validationResult.isValid) {
      throw new Error(`Invalid template ID: ${templateId}`);
    }

    const templateInvalidated = invalidateProjectCache(
      'single_template',
      validationResult.templateId,
    );
    const applicationsInvalidated = invalidateProjectCache(
      'application',
      validationResult.templateId,
    );

    const totalInvalidated = templateInvalidated + applicationsInvalidated;

    return {
      success: true,
      templateId: validationResult.templateId,
      totalInvalidated,
      templateInvalidated,
      applicationsInvalidated,
    };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_template_page',
        action: 'applications_cache_invalidation_error',
      },
      extra: { templateId },
    });

    return { success: false, error: error.message };
  }
}

// Statistiques simplifiées
export async function getSingleTemplateStats(templateId) {
  try {
    const validationResult = await validateTemplateId(templateId);
    if (!validationResult.isValid) {
      throw new Error(`Invalid template ID: ${templateId}`);
    }

    const validTemplateId = validationResult.templateId;
    const cacheKey = generateCacheKey('single_template_stats', {
      templateId: validTemplateId,
    });
    const cachedStats = await projectCache.singleTemplate.get(
      `${cacheKey}_stats`,
    );

    if (cachedStats) {
      return cachedStats;
    }

    const client = await getClient();
    try {
      const statsQuery = `
        SELECT 
          t.template_id,
          t.template_name,
          COUNT(a.application_id) as total_applications,
          COUNT(a.application_id) FILTER (WHERE a.is_active = true) as active_applications,
          AVG(a.application_fee) as avg_fee,
          AVG(a.application_rent) as avg_rent,
          COUNT(DISTINCT a.application_category) as categories_count,
          MIN(a.application_level) as min_level,
          MAX(a.application_level) as max_level
        FROM catalog.templates t
        LEFT JOIN catalog.applications a ON t.template_id = a.application_template_id
        WHERE t.template_id = $1 AND t.is_active = true
        GROUP BY t.template_id, t.template_name
      `;

      const result = await client.query(statsQuery, [validTemplateId]);
      const stats = result.rows[0];

      if (!stats) {
        return {
          error: 'Template not found',
          templateId: validTemplateId,
          timestamp: new Date().toISOString(),
        };
      }

      const enrichedStats = {
        ...stats,
        total_applications: parseInt(stats.total_applications),
        active_applications: parseInt(stats.active_applications),
        avg_fee: parseFloat(stats.avg_fee) || 0,
        avg_rent: parseFloat(stats.avg_rent) || 0,
        categories_count: parseInt(stats.categories_count),
        min_level: parseInt(stats.min_level) || 0,
        max_level: parseInt(stats.max_level) || 0,
        active_ratio:
          stats.total_applications > 0
            ? (stats.active_applications / stats.total_applications).toFixed(3)
            : 0,
        timestamp: new Date().toISOString(),
      };

      await projectCache.singleTemplate.set(
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
        component: 'single_template_page',
        action: 'get_template_stats_error',
      },
      extra: { templateId },
    });

    return {
      error: error.message,
      templateId,
      timestamp: new Date().toISOString(),
    };
  }
}

export default SingleTemplatePage;
