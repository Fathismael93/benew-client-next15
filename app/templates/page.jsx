// app/templates/page.jsx
// Server Component optimisé pour la liste des templates
// Next.js 15 + PostgreSQL + Cache + Monitoring essentiel

import { Suspense } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import TemplatesList from '@/components/templates/TemplatesList';
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
} from '@/instrumentation';
import { optimizeApiCall, getAdaptiveSiteConfig } from '@/utils/performance';
import { limitBenewAPI } from '@/backend/rateLimiter';

// Configuration simplifiée
const CONFIG = {
  cache: { ttl: 10 * 60 * 1000, entityType: 'template' },
  database: { timeout: 8000, retryAttempts: 2 },
  performance: { slowQueryThreshold: 1000 },
  rateLimiting: { enabled: true, preset: 'TEMPLATES_API' },
};

// Requête optimisée
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

// Fonction principale de récupération
async function getTemplatesWithOptimizations() {
  const startTime = performance.now();
  const cacheKey = generateCacheKey('templates_list', {});

  try {
    // Vérifier le cache
    const cachedResult = await projectCache.templates.get(cacheKey);
    if (cachedResult) {
      return {
        ...cachedResult,
        metadata: { ...cachedResult.metadata, fromCache: true },
      };
    }

    // Récupération depuis la DB
    const client = await getClient();
    let templates = [];

    try {
      const templatesQuery = getTemplatesQuery();
      const templatesResult = await client.query(
        templatesQuery.query,
        templatesQuery.params,
      );

      templates = templatesResult.rows;
      const queryDuration = performance.now() - startTime;

      // Log seulement si lent
      if (queryDuration > CONFIG.performance.slowQueryThreshold) {
        captureMessage('Slow templates query detected', {
          level: 'warning',
          tags: {
            component: 'templates_page',
            performance_issue: 'slow_query',
          },
          extra: { duration: queryDuration, templatesCount: templates.length },
        });
      }

      const result = {
        templates,
        metadata: {
          queryDuration,
          fromCache: false,
          timestamp: new Date().toISOString(),
          resultCount: templates.length,
        },
      };

      // Mettre en cache
      await projectCache.templates.set(cacheKey, result, {
        ttl: CONFIG.cache.ttl,
      });

      return result;
    } finally {
      client.release();
    }
  } catch (error) {
    const errorDuration = performance.now() - startTime;

    if (/postgres|pg|database|db|connection/i.test(error.message)) {
      captureDatabaseError(error, {
        table: 'catalog.templates',
        operation: 'select_templates_list',
        tags: { component: 'templates_page' },
        extra: { duration: errorDuration },
      });
    } else {
      captureException(error, {
        tags: {
          component: 'templates_page',
          error_type: 'templates_fetch_error',
        },
        extra: { duration: errorDuration },
      });
    }

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

// Version optimisée avec performance
const getOptimizedTemplates = optimizeApiCall(getTemplatesWithOptimizations, {
  entityType: 'template',
  cacheTTL: CONFIG.cache.ttl,
  throttleDelay: 300,
  retryAttempts: CONFIG.database.retryAttempts,
  retryDelay: 1000,
});

// Composant principal
async function TemplatesPage() {
  const requestStartTime = performance.now();

  try {
    // Rate Limiting
    if (CONFIG.rateLimiting.enabled) {
      const headersList = headers();
      const rateLimitCheck = await limitBenewAPI('templates')({
        headers: headersList,
        url: '/templates',
        method: 'GET',
      });

      if (rateLimitCheck) {
        return notFound();
      }
    }

    const adaptiveConfig = getAdaptiveSiteConfig();
    const templatesData = await getOptimizedTemplates();

    if (
      !templatesData ||
      (!templatesData.templates && templatesData.metadata?.error)
    ) {
      return notFound();
    }

    const totalDuration = performance.now() - requestStartTime;

    // Log seulement si très lent
    if (totalDuration > 2000) {
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
        },
      });
    }

    return (
      <Suspense fallback={<TemplatesPageSkeleton />}>
        <TemplatesList
          templates={templatesData.templates}
          adaptiveConfig={adaptiveConfig}
          performanceMetrics={{
            loadTime: totalDuration,
            fromCache: templatesData.metadata?.fromCache,
            templatesCount: templatesData.templates?.length || 0,
          }}
        />
      </Suspense>
    );
  } catch (error) {
    captureException(error, {
      tags: { component: 'templates_page', error_type: 'page_render_error' },
    });

    return (
      <div className="templates-error-fallback">
        <h1>Templates temporairement indisponibles</h1>
        <p>Veuillez réessayer dans quelques instants.</p>
      </div>
    );
  }
}

// Skeleton component
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

// Metadata
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
  other: {
    'application-name': 'Benew Templates',
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
export async function invalidateTemplatesCache(templateId = null) {
  try {
    const invalidatedCount = invalidateProjectCache('template', templateId);
    return { success: true, invalidatedCount };
  } catch (error) {
    captureException(error, {
      tags: { component: 'templates_page', action: 'cache_invalidation_error' },
      extra: { templateId },
    });
    return { success: false, error: error.message };
  }
}

// Statistiques simplifiées
export async function getTemplatesStats() {
  try {
    const cacheKey = generateCacheKey('templates_stats', {});
    const cachedStats = await projectCache.templates.get(`${cacheKey}_stats`);

    if (cachedStats) {
      return cachedStats;
    }

    const client = await getClient();
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_templates,
          COUNT(*) FILTER (WHERE is_active = true) as active_templates,
          COUNT(*) FILTER (WHERE template_has_web = true) as web_templates,
          COUNT(*) FILTER (WHERE template_has_mobile = true) as mobile_templates,
          COUNT(*) FILTER (WHERE template_added > NOW() - INTERVAL '30 days') as recent_templates,
          MAX(template_added) as latest_template_date,
          MIN(template_added) as oldest_template_date
        FROM catalog.templates
      `;

      const result = await client.query(statsQuery);
      const stats = result.rows[0];

      const enrichedStats = {
        ...stats,
        total_templates: parseInt(stats.total_templates),
        active_templates: parseInt(stats.active_templates),
        web_templates: parseInt(stats.web_templates),
        mobile_templates: parseInt(stats.mobile_templates),
        recent_templates: parseInt(stats.recent_templates),
        web_ratio:
          stats.total_templates > 0
            ? (stats.web_templates / stats.total_templates).toFixed(3)
            : 0,
        mobile_ratio:
          stats.total_templates > 0
            ? (stats.mobile_templates / stats.total_templates).toFixed(3)
            : 0,
        timestamp: new Date().toISOString(),
      };

      await projectCache.templates.set(`${cacheKey}_stats`, enrichedStats, {
        ttl: 10 * 60 * 1000,
      });

      return enrichedStats;
    } finally {
      client.release();
    }
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'templates_page',
        action: 'get_templates_stats_error',
      },
    });

    return {
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

export default TemplatesPage;
