// app/templates/[id]/page.jsx
// Server Component optimisé pour un template spécifique - VERSION PRODUCTION
// Next.js 15 + PostgreSQL + Cache + Monitoring + SEO Dynamique + Sécurité

import { Suspense } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Script from 'next/script';

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
// import { sanitizeHtml, generateCSRFToken } from '@/utils/security';

// Configuration simplifiée
const CONFIG = {
  cache: { ttl: 15 * 60 * 1000, entityType: 'single_template' },
  database: { timeout: 10000, retryAttempts: 3, retryDelay: 1500 },
  performance: { slowQueryThreshold: 1500, alertThreshold: 3000 },
  rateLimiting: { enabled: true, preset: 'TEMPLATES_API' },
  validation: { strictMode: true, sanitizeInputs: true },
  seo: { enableJsonLD: true, enableOpenGraph: true },
};

// Validation et sanitisation de l'ID avec protection XSS
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

// Requêtes optimisées avec colonnes SEO
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
          platform_number
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

// Fonction principale de récupération avec sanitisation
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

      // Sanitisation des données sensibles
      const sanitizedTemplate = {
        ...templateInfo,
      };

      const sanitizedApplications = applications.map((app) => ({
        ...app,
      }));

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

      templateData = {
        template: sanitizedTemplate,
        applications: sanitizedApplications,
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

// Générer les métadonnées dynamiques SEO
export async function generateMetadata({ params }) {
  const { id } = await params;

  // Validation de l'ID
  const validationResult = await validateTemplateId(id);
  if (!validationResult.isValid) {
    return {
      title: 'Template Non Trouvé | Benew',
      description: "Le template demandé n'existe pas ou a été supprimé.",
    };
  }

  // Récupérer les données du template
  const templateData = await getOptimizedSingleTemplate(
    validationResult.templateId,
  );

  if (!templateData || !templateData.template) {
    return {
      title: 'Template Non Trouvé | Benew',
      description: "Le template demandé n'existe pas ou a été supprimé.",
    };
  }

  const template = templateData.template;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  // Créer un titre et une description optimisés pour le SEO
  const title = `${template.template_name} - Template ${template.template_has_web ? 'Web' : ''}${template.template_has_web && template.template_has_mobile ? ' & ' : ''}${template.template_has_mobile ? 'Mobile' : ''} | Benew`;
  const description = `Découvrez ${template.template_name}, un template professionnel avec ${templateData.applications.length} applications disponibles. Solutions web et mobile pour votre business.`;

  return {
    title,
    description,
    keywords: [
      template.template_name,
      'template',
      'Benew',
      'application web',
      'application mobile',
      'Djibouti',
    ].filter(Boolean),

    openGraph: {
      title,
      description,
      url: `${siteUrl}/templates/${template.template_id}`,
      type: 'product',
      siteName: 'Benew',
      images: template.template_image
        ? [
            {
              url: template.template_image,
              width: 1200,
              height: 630,
              alt: template.template_name,
            },
          ]
        : [],
      locale: 'fr_FR',
    },

    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: template.template_image ? [template.template_image] : [],
    },

    alternates: {
      canonical: `${siteUrl}/templates/${template.template_id}`,
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
}

// Composant principal avec toutes les améliorations
async function SingleTemplatePage({ params }) {
  const requestStartTime = performance.now();
  const { id: rawId } = await params;

  try {
    // Validation stricte de l'ID avec protection XSS
    const validationResult = await validateTemplateId(rawId);

    if (!validationResult.isValid) {
      return notFound();
    }

    const templateId = validationResult.templateId;

    // Rate Limiting
    if (CONFIG.rateLimiting.enabled) {
      const headersList = await headers();
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

    // Générer le token CSRF pour les actions sensibles
    // const csrfToken = await generateCSRFToken();

    // Générer les données structurées JSON-LD pour le SEO
    const jsonLdData = generateJsonLD(templateData);

    return (
      <>
        {/* Données structurées JSON-LD pour le SEO */}
        {CONFIG.seo.enableJsonLD && (
          <Script
            id={`json-ld-template-${templateId}`}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
          />
        )}
        {/* Prefetch des ressources critiques */}
        <link
          rel="prefetch"
          href="/api/orders/create"
          as="fetch"
          crossOrigin="anonymous"
        />
        {templateData.applications.slice(0, 3).map((app) => (
          <link
            key={app.application_id}
            rel="prefetch"
            href={`/templates/${templateId}/applications/${app.application_id}`}
            as="document"
          />
        ))}
        <Suspense fallback={<SingleTemplatePageSkeleton />}>
          <SingleTemplateShops
            templateID={templateId}
            applications={templateData.applications}
            platforms={templateData.platforms}
            adaptiveConfig={adaptiveConfig}
            // csrfToken={csrfToken}
            templateInfo={templateData.template}
            performanceMetrics={{
              loadTime: totalDuration,
              fromCache: templateData.metadata?.fromCache,
              queryDuration: templateData.metadata?.queryDuration,
              applicationsCount: templateData.applications?.length || 0,
            }}
          />
        </Suspense>
      </>
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
      <div
        className="single-template-error-fallback"
        role="alert"
        aria-live="polite"
      >
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

// Fonction pour générer les données structurées JSON-LD
function generateJsonLD(templateData) {
  const { template, applications } = templateData;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  // Schema.org Product pour le template
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: template.template_name,
    description: `Template professionnel ${template.template_name}`,
    image: template.template_image,
    url: `${siteUrl}/templates/${template.template_id}`,
    brand: {
      '@type': 'Brand',
      name: 'Benew',
    },

    // Agrégation des prix des applications
    offers:
      applications.length > 0
        ? {
            '@type': 'AggregateOffer',
            priceCurrency: 'DJF',
            lowPrice: Math.min(
              ...applications.map((app) => app.application_fee),
            ),
            highPrice: Math.max(
              ...applications.map((app) => app.application_fee),
            ),
            offerCount: applications.length,
            availability: 'https://schema.org/InStock',
            seller: {
              '@type': 'Organization',
              name: 'Benew',
              url: siteUrl,
            },
          }
        : undefined,

    // Rating si disponible
    // aggregateRating: template.template_rating
    //   ? {
    //       '@type': 'AggregateRating',
    //       bestRating: 5,
    //       worstRating: 1,
    //     }
    //   : undefined,

    // Applications comme variantes du produit
    hasVariant: applications.map((app) => ({
      '@type': 'Product',
      name: app.application_name,
      description: app.application_description,
      image: app.application_images?.[0],
      sku: `APP-${app.application_id}`,
      offers: {
        '@type': 'Offer',
        price: app.application_fee,
        priceCurrency: 'DJF',
        availability: 'https://schema.org/InStock',
        priceValidUntil: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(), // 30 jours
      },
    })),
  };

  // Breadcrumb pour la navigation
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Accueil',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Templates',
        item: `${siteUrl}/templates`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: template.template_name,
        item: `${siteUrl}/templates/${template.template_id}`,
      },
    ],
  };

  return [jsonLd, breadcrumb];
}

// Skeleton component amélioré avec ARIA
function SingleTemplatePageSkeleton() {
  return (
    <div
      className="single-template-page-skeleton"
      role="status"
      aria-live="polite"
      aria-label="Chargement du template"
    >
      <div className="template-header-skeleton">
        <div className="skeleton-image-large" aria-hidden="true"></div>
        <div className="skeleton-content">
          <div className="skeleton-title-large" aria-hidden="true"></div>
          <div className="skeleton-text" aria-hidden="true"></div>
          <div className="skeleton-text" aria-hidden="true"></div>
        </div>
      </div>
      <div className="applications-grid-skeleton">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="application-card-skeleton">
            <div className="skeleton-image" aria-hidden="true"></div>
            <div className="skeleton-content">
              <div className="skeleton-text" aria-hidden="true"></div>
              <div className="skeleton-text" aria-hidden="true"></div>
              <div className="skeleton-price" aria-hidden="true"></div>
            </div>
          </div>
        ))}
      </div>
      <div className="platforms-skeleton">
        <div className="skeleton-title" aria-hidden="true"></div>
        <div className="platforms-list-skeleton">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="platform-item-skeleton">
              <div className="skeleton-icon" aria-hidden="true"></div>
              <div className="skeleton-text" aria-hidden="true"></div>
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Chargement en cours...</span>
    </div>
  );
}

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
// export async function getSingleTemplateStats(templateId) {
//   try {
//     const validationResult = await validateTemplateId(templateId);
//     if (!validationResult.isValid) {
//       throw new Error(`Invalid template ID: ${templateId}`);
//     }

//     const validTemplateId = validationResult.templateId;
//     const cacheKey = generateCacheKey('single_template_stats', {
//       templateId: validTemplateId,
//     });
//     const cachedStats = await projectCache.singleTemplate.get(
//       `${cacheKey}_stats`,
//     );

//     if (cachedStats) {
//       return cachedStats;
//     }

//     const client = await getClient();
//     try {
//       // const statsQuery = `
//       //   SELECT
//       //     t.template_id,
//       //     t.template_name,
//       //     COUNT(a.application_id) as total_applications,
//       //     COUNT(a.application_id) FILTER (WHERE a.is_active = true) as active_applications,
//       //     AVG(a.application_fee) as avg_fee,
//       //     AVG(a.application_rent) as avg_rent,
//       //     COUNT(DISTINCT a.application_category) as categories_count,
//       //     MIN(a.application_level) as min_level,
//       //     MAX(a.application_level) as max_level
//       //   FROM catalog.templates t
//       //   LEFT JOIN catalog.applications a ON t.template_id = a.application_template_id
//       //   WHERE t.template_id = $1 AND t.is_active = true
//       //   GROUP BY t.template_id, t.template_name
//       // `;

//       // const result = await client.query(statsQuery, [validTemplateId]);
//       // const stats = result.rows[0];

//       // if (!stats) {
//       //   return {
//       //     error: 'Template not found',
//       //     templateId: validTemplateId,
//       //     timestamp: new Date().toISOString(),
//       //   };
//       // }

//       // const enrichedStats = {
//       //   ...stats,
//       //   total_applications: parseInt(stats.total_applications),
//       //   active_applications: parseInt(stats.active_applications),
//       //   avg_fee: parseFloat(stats.avg_fee) || 0,
//       //   avg_rent: parseFloat(stats.avg_rent) || 0,
//       //   categories_count: parseInt(stats.categories_count),
//       //   min_level: parseInt(stats.min_level) || 0,
//       //   max_level: parseInt(stats.max_level) || 0,
//       //   active_ratio:
//       //     stats.total_applications > 0
//       //       ? (stats.active_applications / stats.total_applications).toFixed(3)
//       //       : 0,
//       //   timestamp: new Date().toISOString(),
//       // };

//       // await projectCache.singleTemplate.set(
//       //   `${cacheKey}_stats`,
//       //   // enrichedStats,
//       //   {
//       //     ttl: 10 * 60 * 1000,
//       //   },
//       // );

//       return enrichedStats;
//     } finally {
//       client.release();
//     }
//   } catch (error) {
//     captureException(error, {
//       tags: {
//         component: 'single_template_page',
//         action: 'get_template_stats_error',
//       },
//       extra: { templateId },
//     });

//     return {
//       error: error.message,
//       templateId,
//       timestamp: new Date().toISOString(),
//     };
//   }
// }

export default SingleTemplatePage;
