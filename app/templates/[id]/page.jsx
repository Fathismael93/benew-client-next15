// app/templates/[id]/page.jsx
// Server Component production-ready pour un template spécifique
// Next.js 15 + PostgreSQL + Cache + Monitoring + Rate Limiting + Validation

import { Suspense } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import SingleTemplateShops from '@/components/templates/SingleTemplateShops';
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
import { templateIdSchema } from '@/utils/schemas/schema';

// =============================
// CONFIGURATION PRODUCTION
// =============================

const SINGLE_TEMPLATE_CONFIG = {
  // Cache configuration - Plus long pour template spécifique
  cache: {
    ttl: 15 * 60 * 1000, // 15 minutes
    staleWhileRevalidate: 10 * 60 * 1000, // 10 minutes
    maxSize: 300,
    entityType: 'single_template',
  },

  // Database configuration
  database: {
    timeout: 10000, // 10 secondes pour requête complexe
    retryAttempts: 3,
    retryDelay: 1500,
  },

  // Performance thresholds
  performance: {
    slowQueryThreshold: 1500, // 1.5 secondes
    alertThreshold: 3000, // 3 secondes
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
  },
};

// =============================
// VALIDATION & HELPERS
// =============================

/**
 * Valide et sanitise l'ID du template
 * @param {string} id - L'ID du template à valider
 * @returns {Object} Résultat de validation
 */
async function validateTemplateId(id) {
  const startTime = performance.now();

  try {
    // Validation avec Yup schema
    const validatedData = await templateIdSchema.validate(
      { id },
      {
        strict: SINGLE_TEMPLATE_CONFIG.validation.strictMode,
        stripUnknown: true,
      },
    );

    const validationDuration = performance.now() - startTime;

    captureMessage('Template ID validation successful', {
      level: 'debug',
      tags: {
        component: 'single_template_page',
        operation: 'validation',
      },
      extra: {
        templateId: validatedData.id,
        validationDuration,
      },
    });

    return {
      isValid: true,
      templateId: validatedData.id,
      validationDuration,
    };
  } catch (validationError) {
    const validationDuration = performance.now() - startTime;

    captureValidationError(validationError, {
      inputData: { id },
      schema: 'templateIdSchema',
      tags: {
        component: 'single_template_page',
        validation_failed: true,
      },
      extra: {
        rawId: id,
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
 * Requête optimisée pour récupérer les données du template et applications
 * @param {string} templateId - ID du template validé
 * @returns {Object} Requête SQL optimisée
 */
function getTemplateDataQuery(templateId) {
  return {
    // Requête principale avec JOIN optimisé
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

    // Requête pour les plateformes (toujours la même)
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

    // Requête pour vérifier l'existence du template
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

// =============================
// FONCTION PRINCIPALE DE RÉCUPÉRATION
// =============================

/**
 * Récupère les données du template avec toutes les optimisations production
 * @param {string} templateId - ID du template validé
 * @returns {Promise<Object>} Données du template avec métadonnées
 */
async function getSingleTemplateWithOptimizations(templateId) {
  const startTime = performance.now();
  const cacheKey = generateCacheKey('single_template', { templateId });

  try {
    // 1. Vérifier le cache en premier
    const cachedResult = await projectCache.singleTemplate.get(cacheKey);
    if (cachedResult) {
      captureMessage('Single template served from cache', {
        level: 'debug',
        tags: {
          component: 'single_template_page',
          cache_hit: true,
        },
        extra: {
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
    let templateData = null;

    try {
      const queries = getTemplateDataQuery(templateId);
      const queryStartTime = performance.now();

      // Exécuter toutes les requêtes en parallèle pour optimiser les performances
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
        captureMessage('Template not found', {
          level: 'warning',
          tags: {
            component: 'single_template_page',
            template_not_found: true,
          },
          extra: {
            templateId,
            queryDuration,
          },
        });

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

      // Extraire les données du template du premier résultat d'applications
      const templateInfo = templateExistsResult.rows[0];
      const applications = applicationsResult.rows;
      const platforms = platformsResult.rows;

      // Log des requêtes lentes
      if (
        queryDuration > SINGLE_TEMPLATE_CONFIG.performance.slowQueryThreshold
      ) {
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
      if (queryDuration > SINGLE_TEMPLATE_CONFIG.performance.alertThreshold) {
        captureMessage('Critical: Very slow single template query', {
          level: 'error',
          tags: {
            component: 'single_template_page',
            performance_issue: 'critical_slow_query',
          },
          extra: {
            templateId,
            duration: queryDuration,
            threshold: SINGLE_TEMPLATE_CONFIG.performance.alertThreshold,
          },
        });
      }

      // 3. Préparer les résultats avec métadonnées enrichies
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

      // 4. Mettre en cache le résultat
      await projectCache.singleTemplate.set(cacheKey, templateData, {
        ttl: SINGLE_TEMPLATE_CONFIG.cache.ttl,
      });

      captureMessage('Single template loaded from database', {
        level: 'info',
        tags: {
          component: 'single_template_page',
          cache_miss: true,
        },
        extra: {
          templateId,
          duration: queryDuration,
          applicationsCount: applications.length,
          platformsCount: platforms.length,
        },
      });

      return templateData;
    } finally {
      // Toujours libérer le client
      client.release();
    }
  } catch (error) {
    const errorDuration = performance.now() - startTime;

    // Gestion spécialisée des erreurs de base de données
    if (/postgres|pg|database|db|connection/i.test(error.message)) {
      captureDatabaseError(error, {
        table: 'catalog.templates, catalog.applications, admin.platforms',
        operation: 'select_single_template_with_applications',
        queryType: 'complex_join',
        tags: {
          component: 'single_template_page',
        },
        extra: {
          templateId,
          duration: errorDuration,
          cacheKey: cacheKey.substring(0, 50),
        },
      });
    } else {
      captureException(error, {
        tags: {
          component: 'single_template_page',
          error_type: 'single_template_fetch_error',
        },
        extra: {
          templateId,
          duration: errorDuration,
          cacheKey: cacheKey.substring(0, 50),
        },
      });
    }

    // Retourner un fallback gracieux
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

// =============================
// FONCTION OPTIMISÉE AVEC PERFORMANCE
// =============================

// Créer une version optimisée avec toutes les améliorations
const getOptimizedSingleTemplate = optimizeApiCall(
  getSingleTemplateWithOptimizations,
  {
    entityType: 'single_template',
    cacheTTL: SINGLE_TEMPLATE_CONFIG.cache.ttl,
    throttleDelay: 200, // 200ms entre les appels
    retryAttempts: SINGLE_TEMPLATE_CONFIG.database.retryAttempts,
    retryDelay: SINGLE_TEMPLATE_CONFIG.database.retryDelay,
  },
);

// =============================
// COMPOSANT PRINCIPAL
// =============================

/**
 * Server Component pour une page de template spécifique
 * Production-ready avec validation, cache et monitoring
 */
async function SingleTemplatePage({ params }) {
  const requestStartTime = performance.now();
  const { id: rawId } = await params;

  try {
    // 1. Validation stricte de l'ID du template
    const validationResult = await validateTemplateId(rawId);

    if (!validationResult.isValid) {
      captureMessage('Single template page: Invalid template ID', {
        level: 'warning',
        tags: {
          component: 'single_template_page',
          issue_type: 'invalid_id',
        },
        extra: {
          rawId,
          validationError: validationResult.error,
        },
      });

      return notFound();
    }

    const templateId = validationResult.templateId;

    // 2. Rate Limiting (protection contre l'abus)
    if (SINGLE_TEMPLATE_CONFIG.rateLimiting.enabled) {
      const headersList = headers();
      const rateLimitCheck = await limitBenewAPI('templates')({
        headers: headersList,
        url: `/templates/${templateId}`,
        method: 'GET',
      });

      if (rateLimitCheck) {
        // Rate limit dépassé
        return notFound();
      }
    }

    // 3. Configuration adaptative selon les performances réseau
    const adaptiveConfig = getAdaptiveSiteConfig();

    // 4. Récupération des données avec toutes les optimisations
    const templateData = await getOptimizedSingleTemplate(templateId);

    // 5. Vérification des résultats - Template inexistant
    if (
      !templateData ||
      !templateData.template ||
      templateData.metadata?.templateExists === false
    ) {
      captureMessage('Single template page: Template not found', {
        level: 'info',
        tags: {
          component: 'single_template_page',
          issue_type: 'template_not_found',
        },
        extra: {
          templateId,
          adaptiveConfig: adaptiveConfig.networkInfo,
        },
      });

      return notFound();
    }

    // 6. Vérification des erreurs de données
    if (templateData.metadata?.error) {
      captureMessage('Single template page: Data error', {
        level: 'error',
        tags: {
          component: 'single_template_page',
          issue_type: 'data_error',
        },
        extra: {
          templateId,
          errorMessage: templateData.metadata.errorMessage,
        },
      });

      return notFound();
    }

    // 7. Métriques de performance
    const totalDuration = performance.now() - requestStartTime;

    if (totalDuration > 3000) {
      // Plus de 3 secondes pour page spécifique
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
          networkInfo: adaptiveConfig.networkInfo,
        },
      });
    }

    // 8. Log de succès en développement
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Single Template Page] Loaded successfully:`, {
        templateId,
        templateName: templateData.template?.template_name,
        applicationsCount: templateData.applications?.length || 0,
        platformsCount: templateData.platforms?.length || 0,
        totalDuration: `${totalDuration.toFixed(2)}ms`,
        fromCache: templateData.metadata?.fromCache,
      });
    }

    // 9. Retourner le composant avec les données
    return (
      <Suspense fallback={<SingleTemplatePageSkeleton />}>
        <SingleTemplateShops
          templateID={templateId}
          applications={templateData.applications}
          platforms={templateData.platforms}
          template={templateData.template}
          adaptiveConfig={adaptiveConfig}
          performanceMetrics={{
            loadTime: totalDuration,
            fromCache: templateData.metadata?.fromCache,
            queryDuration: templateData.metadata?.queryDuration,
          }}
        />
      </Suspense>
    );
  } catch (error) {
    const errorDuration = performance.now() - requestStartTime;

    captureException(error, {
      tags: {
        component: 'single_template_page',
        error_type: 'page_render_error',
      },
      extra: {
        rawId,
        duration: errorDuration,
      },
    });

    // Log en développement
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Single Template Page] Error:', error);
    }

    // Fallback gracieux
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

// =============================
// COMPOSANT DE LOADING SKELETON
// =============================

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

// =============================
// CONFIGURATION DES METADATA
// =============================

export async function generateMetadata({ params }) {
  const { id: rawId } = await params;

  try {
    // Validation rapide pour metadata
    const validationResult = await validateTemplateId(rawId);
    if (!validationResult.isValid) {
      return {
        title: 'Template non trouvé - Benew',
        description:
          "Le template demandé n'existe pas ou n'est plus disponible.",
      };
    }

    const templateId = validationResult.templateId;

    // Essayer de récupérer depuis le cache pour les metadata
    const cacheKey = generateCacheKey('single_template', { templateId });
    const cachedData = await projectCache.singleTemplate.get(cacheKey);

    if (cachedData && cachedData.template) {
      const template = cachedData.template;
      return {
        title: `${template.template_name} - Templates Benew`,
        description:
          template.template_description ||
          `Découvrez le template ${template.template_name} et ses applications sur Benew.`,
        robots: {
          index: true,
          follow: true,
        },
        alternates: {
          canonical: `/templates/${templateId}`,
        },
        openGraph: {
          title: `${template.template_name} - Templates Benew`,
          description:
            template.template_description ||
            `Template ${template.template_name} avec applications web et mobile.`,
          images: template.template_image ? [template.template_image] : [],
          type: 'website',
        },
      };
    }

    // Fallback metadata si pas de cache
    return {
      title: 'Template Benew',
      description: 'Découvrez ce template et ses applications sur Benew.',
      robots: {
        index: true,
        follow: true,
      },
      alternates: {
        canonical: `/templates/${templateId}`,
      },
    };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_template_metadata',
        error_type: 'metadata_generation_error',
      },
      extra: { rawId },
    });

    return {
      title: 'Template - Benew',
      description: 'Template Benew',
    };
  }
}

// =============================
// UTILITAIRES D'INVALIDATION
// =============================

/**
 * Fonction pour invalider le cache d'un template spécifique
 * @param {string} templateId - ID du template à invalider
 */
export async function invalidateSingleTemplateCache(templateId) {
  try {
    // Valider l'ID avant invalidation
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

    captureMessage('Single template cache invalidated', {
      level: 'info',
      tags: {
        component: 'single_template_page',
        action: 'cache_invalidation',
      },
      extra: {
        templateId: validTemplateId,
        invalidatedCount,
        timestamp: new Date().toISOString(),
      },
    });

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

/**
 * Fonction pour invalider le cache des applications d'un template
 * @param {string} templateId - ID du template
 */
export async function invalidateTemplateApplicationsCache(templateId) {
  try {
    const validationResult = await validateTemplateId(templateId);
    if (!validationResult.isValid) {
      throw new Error(`Invalid template ID: ${templateId}`);
    }

    // Invalider à la fois le cache du template et celui des applications
    const templateInvalidated = invalidateProjectCache(
      'single_template',
      validationResult.templateId,
    );
    const applicationsInvalidated = invalidateProjectCache(
      'application',
      validationResult.templateId,
    );

    const totalInvalidated = templateInvalidated + applicationsInvalidated;

    captureMessage('Template applications cache invalidated', {
      level: 'info',
      tags: {
        component: 'single_template_page',
        action: 'applications_cache_invalidation',
      },
      extra: {
        templateId: validationResult.templateId,
        totalInvalidated,
        templateInvalidated,
        applicationsInvalidated,
        timestamp: new Date().toISOString(),
      },
    });

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

// =============================
// MONITORING ET DIAGNOSTICS
// =============================

/**
 * Fonction de diagnostic pour le monitoring (développement)
 */
export async function getSingleTemplatePageDiagnostics(templateId) {
  if (process.env.NODE_ENV === 'production') {
    return { error: 'Diagnostics not available in production' };
  }

  try {
    // Valider l'ID
    const validationResult = await validateTemplateId(templateId);
    if (!validationResult.isValid) {
      return {
        error: 'Invalid template ID',
        validationError: validationResult.error,
      };
    }

    const validTemplateId = validationResult.templateId;

    const [cacheStats, performanceStats, dbHealth] = await Promise.all([
      projectCache.singleTemplate.getStats(),
      getSitePerformanceStats(),
      monitoring.getHealth(),
    ]);

    // Vérifier le cache spécifique
    const cacheKey = generateCacheKey('single_template', {
      templateId: validTemplateId,
    });
    const cachedData = await projectCache.singleTemplate.get(cacheKey);

    return {
      templateId: validTemplateId,
      validation: validationResult,
      cache: {
        ...cacheStats,
        specificTemplate: {
          cached: !!cachedData,
          cacheKey: cacheKey.substring(0, 50),
          data: cachedData
            ? {
                template: !!cachedData.template,
                applicationsCount: cachedData.applications?.length || 0,
                platformsCount: cachedData.platforms?.length || 0,
                fromCache: cachedData.metadata?.fromCache,
                timestamp: cachedData.metadata?.timestamp,
              }
            : null,
        },
      },
      performance: performanceStats,
      database: dbHealth,
      config: SINGLE_TEMPLATE_CONFIG,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return { error: error.message };
  }
}

export default SingleTemplatePage;
