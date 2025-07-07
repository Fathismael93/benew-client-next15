// app/blog/page.jsx
// Server Component production-ready pour la liste des articles de blog
// Next.js 15 + PostgreSQL + Cache + Monitoring + Rate Limiting

import { Suspense } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import ListBlog from '@/components/blog/ListBlog';
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

// =============================
// CONFIGURATION PRODUCTION
// =============================

const BLOG_CONFIG = {
  // Cache configuration
  cache: {
    ttl: 5 * 60 * 1000, // 5 minutes (contenu plus dynamique que templates)
    staleWhileRevalidate: 2 * 60 * 1000, // 2 minutes
    maxSize: 150,
    entityType: 'blog_article',
  },

  // Database configuration
  database: {
    timeout: 6000, // 6 secondes max
    retryAttempts: 2,
    retryDelay: 1000,
  },

  // Performance thresholds
  performance: {
    slowQueryThreshold: 800, // 800ms pour blog (plus rapide que templates)
  },

  // Rate limiting
  rateLimiting: {
    enabled: true,
    preset: 'BLOG_API',
  },
};

// =============================
// VALIDATION & HELPERS
// =============================

/**
 * Fonction optimisée pour récupérer tous les articles actifs
 * @returns {Object} Requête SQL optimisée avec index
 */
function getBlogArticlesQuery() {
  return {
    query: `
      SELECT 
        article_id, 
        article_title, 
        article_image, 
        TO_CHAR(article_created, 'DD/MM/YYYY') as created,
        article_created as created_raw
      FROM admin.articles 
      WHERE is_active = true 
      ORDER BY article_created DESC, article_id DESC
    `,
    params: [],
  };
}

/**
 * Validation et enrichissement des données d'articles
 * @param {Array} articles - Articles bruts de la DB
 * @returns {Array} Articles validés et enrichis
 */
function validateAndEnrichArticles(articles) {
  if (!Array.isArray(articles)) return [];

  return articles
    .filter((article) => {
      // Validation basique des données critiques
      return (
        article.article_id &&
        article.article_title &&
        article.article_image &&
        article.created
      );
    })
    .map((article) => {
      // Enrichissement avec métadonnées
      return {
        ...article,
        // URL canonique pour SEO
        canonical_url: `/blog/${article.article_id}`,
        // Image optimisée Cloudinary pour liste
        optimized_image: article.article_image.includes('cloudinary.com')
          ? article.article_image.replace(
              '/upload/',
              '/upload/w_400,h_300,c_fill,q_auto:low,f_auto/',
            )
          : article.article_image,
        // Métadonnées pour cache
        cache_key: `article_${article.article_id}`,
        // Type d'entité pour invalidation
        entity_type: 'blog_article',
      };
    });
}

// =============================
// FONCTION PRINCIPALE DE RÉCUPÉRATION
// =============================

/**
 * Récupère tous les articles avec toutes les optimisations production
 * @returns {Promise<Object>} Liste des articles avec métadonnées
 */
async function getBlogArticlesWithOptimizations() {
  const startTime = performance.now();
  const cacheKey = generateCacheKey('blog_articles_list', {});

  try {
    // 1. Vérifier le cache en premier
    const cachedResult = await projectCache.blogArticles.get(cacheKey);
    if (cachedResult) {
      captureMessage('Blog articles served from cache', {
        level: 'debug',
        tags: {
          component: 'blog_page',
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
    let articles = [];

    try {
      // Exécuter la requête optimisée
      const articlesQuery = getBlogArticlesQuery();
      const articlesResult = await client.query(
        articlesQuery.query,
        articlesQuery.params,
      );

      const rawArticles = articlesResult.rows;
      const queryDuration = performance.now() - startTime;

      // Log des requêtes lentes
      if (queryDuration > BLOG_CONFIG.performance.slowQueryThreshold) {
        captureMessage('Slow blog query detected', {
          level: 'warning',
          tags: {
            component: 'blog_page',
            performance_issue: 'slow_query',
          },
          extra: {
            duration: queryDuration,
            articlesCount: rawArticles.length,
          },
        });
      }

      // 3. Validation et enrichissement des données
      articles = validateAndEnrichArticles(rawArticles);

      // 4. Préparer les résultats avec métadonnées enrichies
      const result = {
        articles,
        metadata: {
          queryDuration: queryDuration,
          fromCache: false,
          timestamp: new Date().toISOString(),
          resultCount: articles.length,
          validationPassed: articles.length === rawArticles.length,
          // Métriques spécifiques au blog
          blogMetrics: {
            totalArticles: articles.length,
            recentArticles: articles.filter((article) => {
              const created = new Date(article.created_raw);
              const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
              return created > weekAgo;
            }).length,
            hasCloudinaryImages: articles.filter((article) =>
              article.article_image.includes('cloudinary.com'),
            ).length,
          },
        },
      };

      // 5. Mettre en cache le résultat
      await projectCache.blogArticles.set(cacheKey, result, {
        ttl: BLOG_CONFIG.cache.ttl,
      });

      captureMessage('Blog articles loaded from database', {
        level: 'info',
        tags: {
          component: 'blog_page',
          cache_miss: true,
        },
        extra: {
          duration: queryDuration,
          articlesCount: articles.length,
          validationIssues: rawArticles.length - articles.length,
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
        table: 'admin.articles',
        operation: 'select_blog_articles_list',
        queryType: 'select_all',
        tags: {
          component: 'blog_page',
        },
        extra: {
          duration: errorDuration,
          cacheKey: cacheKey.substring(0, 50),
        },
      });
    } else {
      captureException(error, {
        tags: {
          component: 'blog_page',
          error_type: 'blog_fetch_error',
        },
        extra: {
          duration: errorDuration,
          cacheKey: cacheKey.substring(0, 50),
        },
      });
    }

    // Retourner un fallback gracieux
    return {
      articles: [],
      metadata: {
        queryDuration: errorDuration,
        fromCache: false,
        timestamp: new Date().toISOString(),
        resultCount: 0,
        error: true,
        errorMessage: 'Failed to load blog articles',
        errorType: error.code || 'unknown',
      },
    };
  }
}

// =============================
// FONCTION OPTIMISÉE AVEC PERFORMANCE
// =============================

// Créer une version optimisée avec toutes les améliorations
const getOptimizedBlogArticles = optimizeApiCall(
  getBlogArticlesWithOptimizations,
  {
    entityType: 'blog_article',
    cacheTTL: BLOG_CONFIG.cache.ttl,
    throttleDelay: 200, // 200ms entre les appels (plus rapide pour blog)
    retryAttempts: BLOG_CONFIG.database.retryAttempts,
    retryDelay: BLOG_CONFIG.database.retryDelay,
  },
);

// =============================
// COMPOSANT PRINCIPAL
// =============================

/**
 * Server Component pour la page du blog
 * Production-ready avec toutes les optimisations
 */
async function BlogPage() {
  const requestStartTime = performance.now();

  try {
    // 1. Rate Limiting (protection contre l'abus)
    if (BLOG_CONFIG.rateLimiting.enabled) {
      const headersList = headers();
      const rateLimitCheck = await limitBenewAPI('blog')({
        headers: headersList,
        url: '/blog',
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
    const blogData = await getOptimizedBlogArticles();

    // 4. Vérification des résultats
    if (!blogData || (!blogData.articles && blogData.metadata?.error)) {
      captureMessage('Blog page: No data available', {
        level: 'warning',
        tags: {
          component: 'blog_page',
          issue_type: 'no_data',
        },
        extra: {
          adaptiveConfig: adaptiveConfig.networkInfo,
          errorDetails: blogData?.metadata,
        },
      });

      return notFound();
    }

    // 5. Métriques de performance
    const totalDuration = performance.now() - requestStartTime;

    if (totalDuration > 1500) {
      // Plus de 1.5 secondes (plus strict pour blog)
      captureMessage('Slow blog page load', {
        level: 'warning',
        tags: {
          component: 'blog_page',
          performance_issue: 'slow_page_load',
        },
        extra: {
          totalDuration,
          queryDuration: blogData.metadata?.queryDuration,
          articlesCount: blogData.articles?.length,
          fromCache: blogData.metadata?.fromCache,
          networkInfo: adaptiveConfig.networkInfo,
          blogMetrics: blogData.metadata?.blogMetrics,
        },
      });
    }

    // 6. Log de succès en développement
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Blog Page] Loaded successfully:`, {
        articlesCount: blogData.articles?.length || 0,
        totalDuration: `${totalDuration.toFixed(2)}ms`,
        fromCache: blogData.metadata?.fromCache,
        recentArticles: blogData.metadata?.blogMetrics?.recentArticles || 0,
        validationPassed: blogData.metadata?.validationPassed,
      });
    }

    // 7. Retourner le composant avec les données
    return (
      <Suspense fallback={<BlogPageSkeleton />}>
        <ListBlog
          posts={blogData.articles}
          adaptiveConfig={adaptiveConfig}
          performanceMetrics={{
            loadTime: totalDuration,
            fromCache: blogData.metadata?.fromCache,
            articlesCount: blogData.articles?.length || 0,
          }}
          blogMetrics={blogData.metadata?.blogMetrics}
        />
      </Suspense>
    );
  } catch (error) {
    const errorDuration = performance.now() - requestStartTime;

    captureException(error, {
      tags: {
        component: 'blog_page',
        error_type: 'page_render_error',
      },
      extra: {
        duration: errorDuration,
      },
    });

    // Log en développement
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Blog Page] Error:', error);
    }

    // Fallback gracieux
    return (
      <div className="blog-error-fallback">
        <h1>Blog temporairement indisponible</h1>
        <p>Veuillez réessayer dans quelques instants.</p>
      </div>
    );
  }
}

// =============================
// COMPOSANT DE LOADING SKELETON
// =============================

function BlogPageSkeleton() {
  return (
    <div className="blog-page-skeleton">
      <div className="blog-header-skeleton">
        <div className="skeleton-title"></div>
        <div className="skeleton-subtitle"></div>
      </div>
      <div className="blog-grid-skeleton">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="blog-card-skeleton">
            <div className="skeleton-image"></div>
            <div className="skeleton-content">
              <div className="skeleton-text"></div>
              <div className="skeleton-text"></div>
              <div className="skeleton-date"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================
// CONFIGURATION DES METADATA
// =============================

export async function generateMetadata() {
  return {
    title: 'Blog Benew - Articles et Actualités',
    description:
      'Découvrez nos derniers articles sur le développement web, les templates et les applications mobiles.',
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: '/blog',
    },
    openGraph: {
      title: 'Blog Benew',
      description: 'Articles et actualités sur le développement web et mobile',
      type: 'website',
      locale: 'fr_FR',
    },
  };
}

// =============================
// UTILITAIRES D'INVALIDATION
// =============================

/**
 * Fonction pour invalider le cache des articles (export pour les Server Actions)
 * @param {string} articleId - ID spécifique de l'article (optionnel)
 */
export async function invalidateBlogCache(articleId = null) {
  try {
    const invalidatedCount = invalidateProjectCache('blog_article', articleId);

    captureMessage('Blog cache invalidated', {
      level: 'info',
      tags: {
        component: 'blog_page',
        action: 'cache_invalidation',
      },
      extra: {
        articleId,
        invalidatedCount,
        timestamp: new Date().toISOString(),
      },
    });

    return { success: true, invalidatedCount };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'blog_page',
        action: 'cache_invalidation_error',
      },
      extra: { articleId },
    });

    return { success: false, error: error.message };
  }
}

/**
 * Fonction pour invalider un article spécifique (pour Server Actions)
 * @param {string} articleId - ID de l'article à invalider
 */
export async function invalidateSpecificArticle(articleId) {
  if (!articleId) {
    throw new Error('Article ID is required for specific invalidation');
  }

  try {
    // Invalider le cache de la liste des articles
    await invalidateBlogCache();

    // Invalider le cache de l'article spécifique
    const singleArticleKey = generateCacheKey('single_blog_article', {
      id: articleId,
    });
    await projectCache.singleBlogArticle.delete(singleArticleKey);

    captureMessage('Specific blog article cache invalidated', {
      level: 'info',
      tags: {
        component: 'blog_page',
        action: 'specific_article_invalidation',
      },
      extra: {
        articleId,
        cacheKey: singleArticleKey.substring(0, 50),
        timestamp: new Date().toISOString(),
      },
    });

    return { success: true, articleId };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'blog_page',
        action: 'specific_article_invalidation_error',
      },
      extra: { articleId },
    });

    return { success: false, error: error.message, articleId };
  }
}

// =============================
// MONITORING ET DIAGNOSTICS
// =============================

/**
 * Fonction de diagnostic pour le monitoring (développement)
 */
export async function getBlogPageDiagnostics() {
  if (process.env.NODE_ENV === 'production') {
    return { error: 'Diagnostics not available in production' };
  }

  try {
    const [cacheStats, performanceStats, dbHealth] = await Promise.all([
      projectCache.blogArticles.getStats(),
      getSitePerformanceStats(),
      monitoring.getHealth(),
    ]);

    return {
      cache: cacheStats,
      performance: performanceStats,
      database: dbHealth,
      config: BLOG_CONFIG,
      timestamp: new Date().toISOString(),
      // Spécifique au blog
      blogSpecific: {
        averageArticleLoadTime:
          performanceStats.metrics?.apiCallTimes?.blog_article?.average || 0,
        cacheHitRate: cacheStats.hitRate || 0,
        recentErrors:
          performanceStats.metrics?.componentRenderTimes?.blog || [],
      },
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Fonction pour obtenir les statistiques du blog (monitoring externe)
 */
export async function getBlogStats() {
  try {
    const cacheKey = generateCacheKey('blog_stats', {});

    // Vérifier le cache d'abord (stats moins critiques)
    const cachedStats = await projectCache.blogArticles.get(
      `${cacheKey}_stats`,
    );
    if (cachedStats) {
      return cachedStats;
    }

    const client = await getClient();
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_articles,
          COUNT(*) FILTER (WHERE is_active = true) as active_articles,
          COUNT(*) FILTER (WHERE article_created > NOW() - INTERVAL '7 days') as recent_articles,
          COUNT(*) FILTER (WHERE article_created > NOW() - INTERVAL '30 days') as monthly_articles,
          MAX(article_created) as latest_article_date,
          MIN(article_created) as oldest_article_date
        FROM admin.articles
      `;

      const result = await client.query(statsQuery);
      const stats = result.rows[0];

      // Enrichir avec des métriques calculées
      const enrichedStats = {
        ...stats,
        total_articles: parseInt(stats.total_articles),
        active_articles: parseInt(stats.active_articles),
        recent_articles: parseInt(stats.recent_articles),
        monthly_articles: parseInt(stats.monthly_articles),
        activity_rate:
          stats.total_articles > 0
            ? (stats.recent_articles / stats.total_articles).toFixed(3)
            : 0,
        monthly_rate:
          stats.total_articles > 0
            ? (stats.monthly_articles / stats.total_articles).toFixed(3)
            : 0,
        timestamp: new Date().toISOString(),
      };

      // Mettre en cache pour 10 minutes
      await projectCache.blogArticles.set(`${cacheKey}_stats`, enrichedStats, {
        ttl: 10 * 60 * 1000,
      });

      return enrichedStats;
    } finally {
      client.release();
    }
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'blog_page',
        action: 'get_blog_stats_error',
      },
    });

    return {
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

export default BlogPage;
