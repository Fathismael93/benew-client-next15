// app/templates/page.jsx
// Server Component production-ready pour la liste des templates
// Next.js 15 + PostgreSQL + Cache + Monitoring + Rate Limiting

import { Suspense } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import TemplatesList from '@/components/templates/TemplatesList';
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
} from '@/instrumentation';
import {
  optimizeApiCall,
  getSitePerformanceStats,
  getAdaptiveSiteConfig,
} from '@/utils/performance';
import { limitBenewAPI } from '@/backend/rateLimiter';

export const metadata = {
  title: 'Templates - Benew | Applications Web & Mobile',
  description:
    "Explorez notre collection de templates premium pour applications web et mobile. Solutions professionnelles prêtes à l'emploi pour votre business en ligne.",
  keywords: [
    'templates premium',
    'applications web',
    'applications mobile',
    'e-commerce',
    'solutions digitales',
    'développement',
    'Benew',
    'Djibouti',
  ],

  openGraph: {
    title: 'Templates Premium Benew - Collection Complète',
    description:
      'Découvrez nos templates professionnels pour applications web et mobile. Designs modernes et fonctionnalités avancées.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/templates`,
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Templates Premium Benew',
    description:
      'Collection de templates professionnels pour applications web et mobile.',
  },

  // Données structurées pour le SEO
  other: {
    'application-name': 'Benew Templates',
    'theme-color': '#f6a037',
  },

  // URL canonique
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

// =============================
// CONFIGURATION PRODUCTION
// =============================

const TEMPLATES_CONFIG = {
  // Cache configuration
  cache: {
    ttl: 10 * 60 * 1000, // 10 minutes
    staleWhileRevalidate: 5 * 60 * 1000, // 5 minutes
    maxSize: 200,
    entityType: 'template',
  },

  // Database configuration
  database: {
    timeout: 8000, // 8 secondes max
    retryAttempts: 2,
    retryDelay: 1000,
  },

  // Performance thresholds
  performance: {
    slowQueryThreshold: 1000, // 1 seconde
  },

  // Rate limiting
  rateLimiting: {
    enabled: true,
    preset: 'TEMPLATES_API',
  },
};

// =============================
// VALIDATION & HELPERS
// =============================

/**
 * Fonction simple pour récupérer tous les templates actifs
 * @returns {Object} Requête SQL simple
 */
function getTemplatesQuery() {
  return {
    query: `
      SELECT template_id, template_name, template_image, template_has_web, template_has_mobile 
      FROM catalog.templates 
      WHERE is_active=true 
      ORDER BY template_added DESC
    `,
    params: [],
  };
}

// =============================
// FONCTION PRINCIPALE DE RÉCUPÉRATION
// =============================

/**
 * Récupère tous les templates avec toutes les optimisations production
 * @returns {Promise<Object>} Liste des templates avec métadonnées
 */
async function getTemplatesWithOptimizations() {
  const startTime = performance.now();
  const cacheKey = generateCacheKey('templates_list', {});

  try {
    // 1. Vérifier le cache en premier
    const cachedResult = await projectCache.templates.get(cacheKey);
    if (cachedResult) {
      captureMessage('Templates served from cache', {
        level: 'debug',
        tags: {
          component: 'templates_page',
          cache_hit: true,
        },
        extra: {
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
    let templates = [];

    try {
      // Exécuter la requête simple originale
      const templatesQuery = getTemplatesQuery();
      const templatesResult = await client.query(
        templatesQuery.query,
        templatesQuery.params,
      );

      templates = templatesResult.rows;
      const queryDuration = performance.now() - startTime;

      // Log des requêtes lentes
      if (queryDuration > TEMPLATES_CONFIG.performance.slowQueryThreshold) {
        captureMessage('Slow templates query detected', {
          level: 'warning',
          tags: {
            component: 'templates_page',
            performance_issue: 'slow_query',
          },
          extra: {
            duration: queryDuration,
            templatesCount: templates.length,
          },
        });
      }

      // 3. Préparer les résultats avec métadonnées simples
      const result = {
        templates,
        metadata: {
          queryDuration: queryDuration,
          fromCache: false,
          timestamp: new Date().toISOString(),
          resultCount: templates.length,
        },
      };

      // 4. Mettre en cache le résultat
      await projectCache.templates.set(cacheKey, result, {
        ttl: TEMPLATES_CONFIG.cache.ttl,
      });

      captureMessage('Templates loaded from database', {
        level: 'info',
        tags: {
          component: 'templates_page',
          cache_miss: true,
        },
        extra: {
          duration: queryDuration,
          templatesCount: templates.length,
        },
      });

      return result;
    } finally {
      // Toujours libérer le client
      client.release();
    }
  } catch (error) {
    const errorDuration = performance.now() - startTime;

    // Gestion spécialisée des erreurs de base de données
    if (/postgres|pg|database|db|connection/i.test(error.message)) {
      captureDatabaseError(error, {
        table: 'catalog.templates',
        operation: 'select_templates_list',
        queryType: 'select_all',
        tags: {
          component: 'templates_page',
        },
        extra: {
          duration: errorDuration,
          cacheKey: cacheKey.substring(0, 50),
        },
      });
    } else {
      captureException(error, {
        tags: {
          component: 'templates_page',
          error_type: 'templates_fetch_error',
        },
        extra: {
          duration: errorDuration,
          cacheKey: cacheKey.substring(0, 50),
        },
      });
    }

    // Retourner un fallback gracieux
    return {
      templates: [],
      metadata: {
        queryDuration: errorDuration,
        fromCache: false,
        timestamp: new Date().toISOString(),
        resultCount: 0,
        error: true,
        errorMessage: 'Failed to load templates',
      },
    };
  }
}

// =============================
// FONCTION OPTIMISÉE AVEC PERFORMANCE
// =============================

// Créer une version optimisée avec toutes les améliorations
const getOptimizedTemplates = optimizeApiCall(getTemplatesWithOptimizations, {
  entityType: 'template',
  cacheTTL: TEMPLATES_CONFIG.cache.ttl,
  throttleDelay: 300, // 300ms entre les appels
  retryAttempts: TEMPLATES_CONFIG.database.retryAttempts,
  retryDelay: TEMPLATES_CONFIG.database.retryDelay,
});

// =============================
// COMPOSANT PRINCIPAL
// =============================

/**
 * Server Component pour la page des templates
 * Production-ready avec toutes les optimisations mais requête simple
 */
async function TemplatesPage() {
  const requestStartTime = performance.now();

  try {
    // 1. Rate Limiting (protection contre l'abus)
    if (TEMPLATES_CONFIG.rateLimiting.enabled) {
      const headersList = headers();
      const rateLimitCheck = await limitBenewAPI('templates')({
        headers: headersList,
        url: '/templates',
        method: 'GET',
      });

      if (rateLimitCheck) {
        // Rate limit dépassé, le middleware a déjà envoyé la réponse
        return notFound();
      }
    }

    // 2. Configuration adaptative selon les performances réseau
    const adaptiveConfig = getAdaptiveSiteConfig();

    // 3. Récupération des données avec toutes les optimisations
    const templatesData = await getOptimizedTemplates();

    // 4. Vérification des résultats
    if (
      !templatesData ||
      (!templatesData.templates && templatesData.metadata?.error)
    ) {
      captureMessage('Templates page: No data available', {
        level: 'warning',
        tags: {
          component: 'templates_page',
          issue_type: 'no_data',
        },
        extra: {
          adaptiveConfig: adaptiveConfig.networkInfo,
        },
      });

      return notFound();
    }

    // 5. Métriques de performance
    const totalDuration = performance.now() - requestStartTime;

    if (totalDuration > 2000) {
      // Plus de 2 secondes
      captureMessage('Slow templates page load', {
        level: 'warning',
        tags: {
          component: 'templates_page',
          performance_issue: 'slow_page_load',
        },
        extra: {
          totalDuration,
          queryDuration: templatesData.metadata?.queryDuration,
          templatesCount: templatesData.templates?.length,
          fromCache: templatesData.metadata?.fromCache,
          networkInfo: adaptiveConfig.networkInfo,
        },
      });
    }

    // 6. Log de succès en développement
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Templates Page] Loaded successfully:`, {
        templatesCount: templatesData.templates?.length || 0,
        totalDuration: `${totalDuration.toFixed(2)}ms`,
        fromCache: templatesData.metadata?.fromCache,
      });
    }

    // 7. Retourner le composant avec les données
    return (
      <Suspense fallback={<TemplatesPageSkeleton />}>
        <TemplatesList
          templates={templatesData.templates}
          adaptiveConfig={adaptiveConfig}
          performanceMetrics={{
            loadTime: totalDuration,
            fromCache: templatesData.metadata?.fromCache,
          }}
        />
      </Suspense>
    );
  } catch (error) {
    const errorDuration = performance.now() - requestStartTime;

    captureException(error, {
      tags: {
        component: 'templates_page',
        error_type: 'page_render_error',
      },
      extra: {
        duration: errorDuration,
      },
    });

    // Log en développement
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Templates Page] Error:', error);
    }

    // Fallback gracieux
    return (
      <div className="templates-error-fallback">
        <h1>Templates temporairement indisponibles</h1>
        <p>Veuillez réessayer dans quelques instants.</p>
      </div>
    );
  }
}

// =============================
// COMPOSANT DE LOADING SKELETON
// =============================

function TemplatesPageSkeleton() {
  return (
    <div className="templates-page-skeleton">
      <div className="templates-header-skeleton">
        <div className="skeleton-title"></div>
        <div className="skeleton-filters"></div>
      </div>
      <div className="templates-grid-skeleton">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="template-card-skeleton">
            <div className="skeleton-image"></div>
            <div className="skeleton-content">
              <div className="skeleton-text"></div>
              <div className="skeleton-text"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================
// UTILITAIRES D'INVALIDATION
// =============================

/**
 * Fonction pour invalider le cache des templates (export pour les Server Actions)
 * @param {string} templateId - ID spécifique du template (optionnel)
 */
export async function invalidateTemplatesCache(templateId = null) {
  try {
    const invalidatedCount = invalidateProjectCache('template', templateId);

    captureMessage('Templates cache invalidated', {
      level: 'info',
      tags: {
        component: 'templates_page',
        action: 'cache_invalidation',
      },
      extra: {
        templateId,
        invalidatedCount,
        timestamp: new Date().toISOString(),
      },
    });

    return { success: true, invalidatedCount };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'templates_page',
        action: 'cache_invalidation_error',
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
export async function getTemplatesPageDiagnostics() {
  if (process.env.NODE_ENV === 'production') {
    return { error: 'Diagnostics not available in production' };
  }

  try {
    const [cacheStats, performanceStats, dbHealth] = await Promise.all([
      projectCache.templates.getStats(),
      getSitePerformanceStats(),
      monitoring.getHealth(),
    ]);

    return {
      cache: cacheStats,
      performance: performanceStats,
      database: dbHealth,
      config: TEMPLATES_CONFIG,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return { error: error.message };
  }
}

export default TemplatesPage;
