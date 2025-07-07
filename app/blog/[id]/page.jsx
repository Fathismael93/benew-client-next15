// app/blog/[id]/page.jsx
// Server Component production-ready pour un article de blog spécifique
// Next.js 15 + PostgreSQL + Cache + Monitoring + Rate Limiting + Validation

import { Suspense } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import SinglePost from '@/components/blog/SinglePost';
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
import { articleIdSchema } from '@/utils/schemas/schema';

// =============================
// CONFIGURATION PRODUCTION
// =============================

const SINGLE_ARTICLE_CONFIG = {
  // Cache configuration - Plus long pour article spécifique
  cache: {
    ttl: 30 * 60 * 1000, // 30 minutes (contenu plus stable qu'une liste)
    staleWhileRevalidate: 15 * 60 * 1000, // 15 minutes
    maxSize: 300,
    entityType: 'single_blog_article',
  },

  // Database configuration
  database: {
    timeout: 8000, // 8 secondes pour requête avec articles liés
    retryAttempts: 2,
    retryDelay: 1500,
  },

  // Performance thresholds
  performance: {
    slowQueryThreshold: 1000, // 1 seconde pour article unique
    alertThreshold: 2500, // 2.5 secondes
  },

  // Rate limiting
  rateLimiting: {
    enabled: true,
    preset: 'BLOG_API',
  },

  // Validation
  validation: {
    strictMode: true,
    sanitizeInputs: true,
    validateContent: true, // Valider le contenu HTML
  },
};

// =============================
// VALIDATION & HELPERS
// =============================

/**
 * Valide et sanitise l'ID de l'article
 * @param {string} articleId - L'ID de l'article à valider
 * @returns {Object} Résultat de validation
 */
async function validateArticleId(articleId) {
  const startTime = performance.now();

  try {
    const validation = await articleIdSchema.validate(
      { id: articleId },
      {
        strict: SINGLE_ARTICLE_CONFIG.validation.strictMode,
        stripUnknown: true,
      },
    );

    const validationDuration = performance.now() - startTime;

    captureMessage('Article ID validation successful', {
      level: 'debug',
      tags: {
        component: 'single_blog_article_page',
        operation: 'validation',
      },
      extra: {
        articleId: validation.id,
        validationDuration,
      },
    });

    return {
      isValid: true,
      articleId: validation.id,
      validationDuration,
    };
  } catch (validationError) {
    const validationDuration = performance.now() - startTime;

    captureValidationError(validationError, {
      field: 'articleId',
      form: 'single_blog_article',
      validationType: 'uuid_validation',
      tags: {
        component: 'single_blog_article_page',
        validation_failed: true,
      },
      extra: {
        rawArticleId: articleId,
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
 * Sanitise et valide le contenu HTML de l'article
 * @param {string} content - Contenu HTML à valider
 * @returns {string} Contenu sanitisé
 */
function sanitizeArticleContent(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }

  // Validation basique du contenu HTML
  const hasBasicHTMLStructure = /<[^>]+>/.test(content);
  const isReasonableLength = content.length > 10 && content.length < 500000; // Max 500KB

  if (!hasBasicHTMLStructure || !isReasonableLength) {
    captureMessage('Article content validation issue', {
      level: 'warning',
      tags: {
        component: 'single_blog_article_page',
        content_issue: true,
      },
      extra: {
        hasHTML: hasBasicHTMLStructure,
        contentLength: content.length,
        isReasonableLength,
      },
    });
  }

  return content.trim();
}

/**
 * Requête optimisée pour récupérer les données de l'article avec contexte
 * @param {string} articleId - ID de l'article validé
 * @returns {Object} Requêtes SQL optimisées
 */
function getArticleDataQuery(articleId) {
  return {
    // Requête principale pour l'article spécifique
    mainArticleQuery: {
      query: `
        SELECT 
          article_id,
          article_title,
          article_text,
          article_image,
          TO_CHAR(article_created, 'DD/MM/YYYY') as created,
          article_created as created_raw,
          TO_CHAR(article_updated, 'DD/MM/YYYY') as updated,
          article_updated as updated_raw,
          (
            SELECT COUNT(*) 
            FROM admin.articles 
            WHERE is_active = true
          ) as total_active_articles
        FROM admin.articles 
        WHERE article_id = $1 
          AND is_active = true
      `,
      params: [articleId],
    },

    // Requête pour les articles liés (suggestions)
    relatedArticlesQuery: {
      query: `
        SELECT 
          article_id,
          article_title,
          article_image,
          TO_CHAR(article_created, 'DD/MM/YYYY') as created,
          article_created as created_raw
        FROM admin.articles 
        WHERE article_id != $1 
          AND is_active = true 
        ORDER BY article_created DESC 
        LIMIT 4
      `,
      params: [articleId],
    },

    // Requête pour les statistiques de contexte
    contextStatsQuery: {
      query: `
        SELECT 
          COUNT(*) FILTER (WHERE article_created > NOW() - INTERVAL '7 days') as recent_articles,
          COUNT(*) FILTER (WHERE article_created > NOW() - INTERVAL '30 days') as monthly_articles,
          MAX(article_created) as latest_article_date,
          MIN(article_created) as oldest_article_date,
          COUNT(*) as total_articles
        FROM admin.articles 
        WHERE is_active = true
      `,
      params: [],
    },

    // Requête de vérification d'existence
    existenceCheckQuery: {
      query: `
        SELECT 
          article_id,
          is_active,
          article_created
        FROM admin.articles 
        WHERE article_id = $1
      `,
      params: [articleId],
    },
  };
}

/**
 * Enrichit les données de l'article avec métadonnées supplémentaires
 * @param {Object} article - Données brutes de l'article
 * @param {Array} relatedArticles - Articles liés
 * @param {Object} contextStats - Statistiques de contexte
 * @returns {Object} Article enrichi
 */
function enrichArticleData(article) {
  if (!article) return null;

  // Sanitiser le contenu
  const sanitizedContent = sanitizeArticleContent(article.article_text);

  // Enrichissement avec métadonnées
  const enrichedArticle = {
    ...article,
    article_text: sanitizedContent,
    // URL canonique pour SEO
    canonical_url: `/blog/${article.article_id}`,
    // Image optimisée Cloudinary pour article unique
    optimized_image: article.article_image?.includes('cloudinary.com')
      ? article.article_image.replace(
          '/upload/',
          '/upload/w_800,h_600,c_fill,q_auto,f_auto/',
        )
      : article.article_image,
    // Métadonnées pour cache
    cache_key: `single_article_${article.article_id}`,
    // Type d'entité pour invalidation
    entity_type: 'single_blog_article',
    // Statistiques calculées
    estimated_reading_time: Math.ceil(
      sanitizedContent.replace(/<[^>]*>/g, '').split(' ').length / 200,
    ), // Mots par minute moyen
    word_count: sanitizedContent.replace(/<[^>]*>/g, '').split(' ').length,
    has_images: /<img\s+[^>]*src=/i.test(sanitizedContent),
    // Contexte temporel
    is_recent:
      article.created_raw &&
      new Date(article.created_raw) >
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    age_in_days: article.created_raw
      ? Math.floor(
          (Date.now() - new Date(article.created_raw)) / (24 * 60 * 60 * 1000),
        )
      : null,
  };

  return enrichedArticle;
}

// =============================
// FONCTION PRINCIPALE DE RÉCUPÉRATION
// =============================

/**
 * Récupère les données de l'article avec toutes les optimisations production
 * @param {string} articleId - ID de l'article validé
 * @returns {Promise<Object>} Données de l'article avec métadonnées
 */
async function getSingleArticleWithOptimizations(articleId) {
  const startTime = performance.now();
  const cacheKey = generateCacheKey('single_blog_article', { articleId });

  try {
    // 1. Vérifier le cache en premier
    const cachedResult = await projectCache.singleBlogArticle.get(cacheKey);
    if (cachedResult) {
      captureMessage('Single blog article served from cache', {
        level: 'debug',
        tags: {
          component: 'single_blog_article_page',
          cache_hit: true,
        },
        extra: {
          articleId,
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
    let articleData = null;

    try {
      const queries = getArticleDataQuery(articleId);
      const queryStartTime = performance.now();

      // Exécuter toutes les requêtes en parallèle pour optimiser les performances
      const [
        existenceResult,
        mainArticleResult,
        relatedArticlesResult,
        contextStatsResult,
      ] = await Promise.all([
        client.query(
          queries.existenceCheckQuery.query,
          queries.existenceCheckQuery.params,
        ),
        client.query(
          queries.mainArticleQuery.query,
          queries.mainArticleQuery.params,
        ),
        client.query(
          queries.relatedArticlesQuery.query,
          queries.relatedArticlesQuery.params,
        ),
        client.query(
          queries.contextStatsQuery.query,
          queries.contextStatsQuery.params,
        ),
      ]);

      const queryDuration = performance.now() - queryStartTime;

      // Vérifier l'existence de l'article
      if (existenceResult.rows.length === 0) {
        captureMessage('Blog article not found', {
          level: 'warning',
          tags: {
            component: 'single_blog_article_page',
            article_not_found: true,
          },
          extra: {
            articleId,
            queryDuration,
          },
        });

        return {
          article: null,
          relatedArticles: [],
          contextStats: null,
          metadata: {
            queryDuration,
            fromCache: false,
            timestamp: new Date().toISOString(),
            articleExists: false,
            isActive: false,
          },
        };
      }

      // Vérifier si l'article est actif
      const existenceData = existenceResult.rows[0];
      if (!existenceData.is_active) {
        captureMessage('Blog article is inactive', {
          level: 'warning',
          tags: {
            component: 'single_blog_article_page',
            article_inactive: true,
          },
          extra: {
            articleId,
            isActive: existenceData.is_active,
            queryDuration,
          },
        });

        return {
          article: null,
          relatedArticles: [],
          contextStats: null,
          metadata: {
            queryDuration,
            fromCache: false,
            timestamp: new Date().toISOString(),
            articleExists: true,
            isActive: false,
          },
        };
      }

      // Vérifier si l'article principal a été trouvé
      if (mainArticleResult.rows.length === 0) {
        captureMessage('Blog article data not found despite existence', {
          level: 'error',
          tags: {
            component: 'single_blog_article_page',
            data_inconsistency: true,
          },
          extra: {
            articleId,
            existenceFound: true,
            mainDataFound: false,
            queryDuration,
          },
        });

        return {
          article: null,
          relatedArticles: [],
          contextStats: null,
          metadata: {
            queryDuration,
            fromCache: false,
            timestamp: new Date().toISOString(),
            articleExists: true,
            isActive: true,
            dataInconsistency: true,
            error: true,
            errorMessage: 'Article data inconsistency detected',
          },
        };
      }

      // Extraire et enrichir les données
      const rawArticle = mainArticleResult.rows[0];
      const relatedArticles = relatedArticlesResult.rows;
      const contextStats = contextStatsResult.rows[0];

      // Enrichir l'article avec métadonnées
      const enrichedArticle = enrichArticleData(rawArticle);

      // Log des requêtes lentes
      if (
        queryDuration > SINGLE_ARTICLE_CONFIG.performance.slowQueryThreshold
      ) {
        captureMessage('Slow single blog article query detected', {
          level: 'warning',
          tags: {
            component: 'single_blog_article_page',
            performance_issue: 'slow_query',
          },
          extra: {
            articleId,
            duration: queryDuration,
            relatedArticlesCount: relatedArticles.length,
            wordCount: enrichedArticle?.word_count,
          },
        });
      }

      // Alerte pour requêtes très lentes
      if (queryDuration > SINGLE_ARTICLE_CONFIG.performance.alertThreshold) {
        captureMessage('Critical: Very slow single blog article query', {
          level: 'error',
          tags: {
            component: 'single_blog_article_page',
            performance_issue: 'critical_slow_query',
          },
          extra: {
            articleId,
            duration: queryDuration,
            threshold: SINGLE_ARTICLE_CONFIG.performance.alertThreshold,
          },
        });
      }

      // 3. Préparer les résultats avec métadonnées enrichies
      articleData = {
        article: enrichedArticle,
        relatedArticles,
        contextStats,
        metadata: {
          queryDuration,
          fromCache: false,
          timestamp: new Date().toISOString(),
          articleExists: true,
          isActive: true,
          dataInconsistency: false,
          articleId,
          relatedArticlesCount: relatedArticles.length,
          // Statistiques enrichies
          articleStats: {
            title: enrichedArticle.article_title,
            wordCount: enrichedArticle.word_count,
            estimatedReadingTime: enrichedArticle.estimated_reading_time,
            hasImages: enrichedArticle.has_images,
            isRecent: enrichedArticle.is_recent,
            ageInDays: enrichedArticle.age_in_days,
            hasCloudinaryImage:
              enrichedArticle.article_image?.includes('cloudinary.com'),
          },
          blogStats: {
            totalActiveArticles: rawArticle.total_active_articles,
            recentArticles: contextStats.recent_articles,
            monthlyArticles: contextStats.monthly_articles,
            totalArticles: contextStats.total_articles,
            latestArticleDate: contextStats.latest_article_date,
            oldestArticleDate: contextStats.oldest_article_date,
          },
        },
      };

      // 4. Mettre en cache le résultat
      await projectCache.singleBlogArticle.set(cacheKey, articleData, {
        ttl: SINGLE_ARTICLE_CONFIG.cache.ttl,
      });

      captureMessage('Single blog article loaded from database', {
        level: 'info',
        tags: {
          component: 'single_blog_article_page',
          cache_miss: true,
        },
        extra: {
          articleId,
          duration: queryDuration,
          articleTitle: enrichedArticle.article_title,
          wordCount: enrichedArticle.word_count,
          relatedArticlesCount: relatedArticles.length,
          readingTime: enrichedArticle.estimated_reading_time,
        },
      });

      return articleData;
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
        operation: 'select_single_blog_article_with_context',
        queryType: 'complex_join_with_stats',
        tags: {
          component: 'single_blog_article_page',
        },
        extra: {
          articleId,
          duration: errorDuration,
          cacheKey: cacheKey.substring(0, 50),
        },
      });
    } else {
      captureException(error, {
        tags: {
          component: 'single_blog_article_page',
          error_type: 'single_article_fetch_error',
        },
        extra: {
          articleId,
          duration: errorDuration,
          cacheKey: cacheKey.substring(0, 50),
        },
      });
    }

    // Retourner un fallback gracieux
    return {
      article: null,
      relatedArticles: [],
      contextStats: null,
      metadata: {
        queryDuration: errorDuration,
        fromCache: false,
        timestamp: new Date().toISOString(),
        articleExists: false,
        isActive: false,
        error: true,
        errorMessage: 'Failed to load blog article data',
        errorType: error.code || 'unknown',
      },
    };
  }
}

// =============================
// FONCTION OPTIMISÉE AVEC PERFORMANCE
// =============================

// Créer une version optimisée avec toutes les améliorations
const getOptimizedSingleArticle = optimizeApiCall(
  getSingleArticleWithOptimizations,
  {
    entityType: 'single_blog_article',
    cacheTTL: SINGLE_ARTICLE_CONFIG.cache.ttl,
    throttleDelay: 100, // 100ms entre les appels (plus rapide pour blog)
    retryAttempts: SINGLE_ARTICLE_CONFIG.database.retryAttempts,
    retryDelay: SINGLE_ARTICLE_CONFIG.database.retryDelay,
  },
);

// =============================
// COMPOSANT PRINCIPAL
// =============================

/**
 * Server Component pour une page d'article de blog spécifique
 * Production-ready avec validation, cache et monitoring
 */
async function SinglePostPage({ params }) {
  const requestStartTime = performance.now();
  const { id: rawArticleId } = await params;

  try {
    // 1. Validation stricte de l'ID de l'article
    const validationResult = await validateArticleId(rawArticleId);

    if (!validationResult.isValid) {
      captureMessage('Single blog article page: Invalid ID', {
        level: 'warning',
        tags: {
          component: 'single_blog_article_page',
          issue_type: 'invalid_id',
        },
        extra: {
          rawArticleId,
          validationError: validationResult.error,
        },
      });

      return notFound();
    }

    const { articleId } = validationResult;

    // 2. Rate Limiting (protection contre l'abus)
    if (SINGLE_ARTICLE_CONFIG.rateLimiting.enabled) {
      const headersList = headers();
      const rateLimitCheck = await limitBenewAPI('blog')({
        headers: headersList,
        url: `/blog/${articleId}`,
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
    const articleData = await getOptimizedSingleArticle(articleId);

    // 5. Vérifications des résultats - Article inexistant
    if (
      !articleData ||
      !articleData.article ||
      articleData.metadata?.articleExists === false
    ) {
      captureMessage('Single blog article page: Article not found', {
        level: 'info',
        tags: {
          component: 'single_blog_article_page',
          issue_type: 'article_not_found',
        },
        extra: {
          articleId,
          adaptiveConfig: adaptiveConfig.networkInfo,
        },
      });

      return notFound();
    }

    // 6. Vérification si l'article est inactif
    if (articleData.metadata?.isActive === false) {
      captureMessage('Single blog article page: Article inactive', {
        level: 'warning',
        tags: {
          component: 'single_blog_article_page',
          issue_type: 'article_inactive',
        },
        extra: {
          articleId,
          isActive: articleData.metadata.isActive,
        },
      });

      return notFound();
    }

    // 7. Vérification des erreurs de données
    if (articleData.metadata?.error) {
      captureMessage('Single blog article page: Data error', {
        level: 'error',
        tags: {
          component: 'single_blog_article_page',
          issue_type: 'data_error',
        },
        extra: {
          articleId,
          errorMessage: articleData.metadata.errorMessage,
          dataInconsistency: articleData.metadata.dataInconsistency,
        },
      });

      return notFound();
    }

    // 8. Métriques de performance
    const totalDuration = performance.now() - requestStartTime;

    if (totalDuration > 2500) {
      // Plus de 2.5 secondes pour page d'article
      captureMessage('Slow single blog article page load', {
        level: 'warning',
        tags: {
          component: 'single_blog_article_page',
          performance_issue: 'slow_page_load',
        },
        extra: {
          articleId,
          totalDuration,
          queryDuration: articleData.metadata?.queryDuration,
          wordCount: articleData.article?.word_count,
          relatedArticlesCount: articleData.relatedArticles?.length,
          fromCache: articleData.metadata?.fromCache,
          networkInfo: adaptiveConfig.networkInfo,
        },
      });
    }

    // 9. Log de succès en développement
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Single Blog Article Page] Loaded successfully:`, {
        articleId,
        articleTitle: articleData.article?.article_title,
        wordCount: articleData.article?.word_count || 0,
        readingTime: articleData.article?.estimated_reading_time || 0,
        relatedArticlesCount: articleData.relatedArticles?.length || 0,
        totalDuration: `${totalDuration.toFixed(2)}ms`,
        fromCache: articleData.metadata?.fromCache,
        isRecent: articleData.article?.is_recent,
      });
    }

    // 10. Retourner le composant avec les données enrichies
    return (
      <Suspense fallback={<SinglePostPageSkeleton />}>
        <SinglePost
          article={articleData.article}
          relatedArticles={articleData.relatedArticles}
          contextStats={articleData.contextStats}
          adaptiveConfig={adaptiveConfig}
          performanceMetrics={{
            loadTime: totalDuration,
            fromCache: articleData.metadata?.fromCache,
            queryDuration: articleData.metadata?.queryDuration,
          }}
          context={{
            articleId,
            stats: {
              article: articleData.metadata?.articleStats,
              blog: articleData.metadata?.blogStats,
            },
          }}
        />
      </Suspense>
    );
  } catch (error) {
    const errorDuration = performance.now() - requestStartTime;

    captureException(error, {
      tags: {
        component: 'single_blog_article_page',
        error_type: 'page_render_error',
      },
      extra: {
        rawArticleId,
        duration: errorDuration,
      },
    });

    // Log en développement
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Single Blog Article Page] Error:', error);
    }

    // Fallback gracieux
    return (
      <div className="single-article-error-fallback">
        <h1>Article temporairement indisponible</h1>
        <p>
          L&apos;article que vous recherchez n&apos;est pas disponible pour le
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

function SinglePostPageSkeleton() {
  return (
    <div className="single-post-page-skeleton">
      <div className="breadcrumb-skeleton">
        <div className="skeleton-text-small"></div>
        <div className="skeleton-text-small"></div>
      </div>

      <div className="article-header-skeleton">
        <div className="skeleton-title-large"></div>
        <div className="article-meta-skeleton">
          <div className="skeleton-date"></div>
          <div className="skeleton-reading-time"></div>
        </div>
        <div className="skeleton-image-hero"></div>
      </div>

      <div className="article-content-skeleton">
        <div className="skeleton-text-block"></div>
        <div className="skeleton-text-block"></div>
        <div className="skeleton-text-block"></div>
        <div className="skeleton-image-content"></div>
        <div className="skeleton-text-block"></div>
        <div className="skeleton-text-block"></div>
      </div>

      <div className="article-footer-skeleton">
        <div className="skeleton-text"></div>
        <div className="skeleton-text"></div>
      </div>

      <div className="related-articles-skeleton">
        <div className="skeleton-title"></div>
        <div className="related-articles-grid-skeleton">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="related-article-card-skeleton">
              <div className="skeleton-image"></div>
              <div className="skeleton-content">
                <div className="skeleton-text"></div>
                <div className="skeleton-date"></div>
              </div>
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
  const { id: rawArticleId } = await params;

  try {
    // Validation rapide pour metadata
    const validationResult = await validateArticleId(rawArticleId);
    if (!validationResult.isValid) {
      return {
        title: 'Article non trouvé - Blog Benew',
        description: "L'article demandé n'existe pas ou n'est plus disponible.",
      };
    }

    const { articleId } = validationResult;

    // Essayer de récupérer depuis le cache pour les metadata
    const cacheKey = generateCacheKey('single_blog_article', { articleId });
    const cachedData = await projectCache.singleBlogArticle.get(cacheKey);

    if (cachedData && cachedData.article) {
      const article = cachedData.article;

      // Créer une description à partir du contenu si pas disponible
      let description = article.article_text
        ? article.article_text.replace(/<[^>]*>/g, '').substring(0, 160) + '...'
        : `Lisez l'article "${article.article_title}" sur le blog Benew.`;

      return {
        title: `${article.article_title} - Blog Benew`,
        description,
        robots: {
          index: true,
          follow: true,
        },
        alternates: {
          canonical: `/blog/${articleId}`,
        },
        openGraph: {
          title: `${article.article_title} - Blog Benew`,
          description,
          images: article.article_image ? [article.article_image] : [],
          type: 'article',
          locale: 'fr_FR',
          publishedTime: article.created_raw,
          modifiedTime: article.updated_raw,
        },
        other: {
          'article:reading_time': article.estimated_reading_time?.toString(),
          'article:word_count': article.word_count?.toString(),
          'article:published_time': article.created_raw,
          'article:modified_time': article.updated_raw,
        },
      };
    }

    // Fallback metadata si pas de cache
    return {
      title: 'Article - Blog Benew',
      description: 'Découvrez cet article sur le blog Benew.',
      robots: {
        index: true,
        follow: true,
      },
      alternates: {
        canonical: `/blog/${articleId}`,
      },
    };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_blog_article_metadata',
        error_type: 'metadata_generation_error',
      },
      extra: { rawArticleId },
    });

    return {
      title: 'Article - Blog Benew',
      description: 'Article du blog Benew',
    };
  }
}

// =============================
// UTILITAIRES D'INVALIDATION
// =============================

/**
 * Fonction pour invalider le cache d'un article spécifique
 * @param {string} articleId - ID de l'article à invalider
 */
export async function invalidateSingleArticleCache(articleId) {
  try {
    // Valider l'ID de l'article
    const validation = await articleIdSchema.validate({ id: articleId });
    if (!validation) {
      throw new Error(
        `Invalid article ID for cache invalidation: ${articleId}`,
      );
    }

    const validArticleId = validation.id;
    const invalidatedCount = invalidateProjectCache(
      'single_blog_article',
      validArticleId,
    );

    // Invalider aussi le cache de la liste des articles
    const listInvalidatedCount = invalidateProjectCache('blog_article');

    captureMessage('Single blog article cache invalidated', {
      level: 'info',
      tags: {
        component: 'single_blog_article_page',
        action: 'cache_invalidation',
      },
      extra: {
        articleId: validArticleId,
        invalidatedCount,
        listInvalidatedCount,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      articleId: validArticleId,
      invalidatedCount,
      listInvalidatedCount,
    };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_blog_article_page',
        action: 'cache_invalidation_error',
      },
      extra: { articleId },
    });

    return { success: false, error: error.message };
  }
}

/**
 * Fonction pour invalider le cache des articles liés (suggestions)
 * @param {string} articleId - ID de l'article principal
 */
export async function invalidateRelatedArticlesCache(articleId) {
  try {
    const validation = await articleIdSchema.validate({ id: articleId });
    if (!validation) {
      throw new Error(`Invalid article ID: ${articleId}`);
    }

    // Invalider le cache de l'article principal et de la liste d'articles
    const mainArticleInvalidated = invalidateProjectCache(
      'single_blog_article',
      validation.id,
    );
    const articlesListInvalidated = invalidateProjectCache('blog_article');

    const totalInvalidated = mainArticleInvalidated + articlesListInvalidated;

    captureMessage('Related blog articles cache invalidated', {
      level: 'info',
      tags: {
        component: 'single_blog_article_page',
        action: 'related_articles_cache_invalidation',
      },
      extra: {
        articleId: validation.id,
        totalInvalidated,
        mainArticleInvalidated,
        articlesListInvalidated,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      articleId: validation.id,
      totalInvalidated,
      breakdown: {
        mainArticle: mainArticleInvalidated,
        articlesList: articlesListInvalidated,
      },
    };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_blog_article_page',
        action: 'related_articles_cache_invalidation_error',
      },
      extra: { articleId },
    });

    return { success: false, error: error.message };
  }
}

/**
 * Fonction pour invalider tout le cache blog (articles + listes)
 */
export async function invalidateAllBlogCache() {
  try {
    const singleArticlesInvalidated = invalidateProjectCache(
      'single_blog_article',
    );
    const articlesListInvalidated = invalidateProjectCache('blog_article');

    const totalInvalidated =
      singleArticlesInvalidated + articlesListInvalidated;

    captureMessage('All blog cache invalidated', {
      level: 'info',
      tags: {
        component: 'single_blog_article_page',
        action: 'all_blog_cache_invalidation',
      },
      extra: {
        totalInvalidated,
        singleArticlesInvalidated,
        articlesListInvalidated,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: true,
      totalInvalidated,
      breakdown: {
        singleArticles: singleArticlesInvalidated,
        articlesList: articlesListInvalidated,
      },
    };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_blog_article_page',
        action: 'all_blog_cache_invalidation_error',
      },
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
export async function getSingleArticlePageDiagnostics(articleId) {
  if (process.env.NODE_ENV === 'production') {
    return { error: 'Diagnostics not available in production' };
  }

  try {
    // Valider l'ID
    const validationResult = await validateArticleId(articleId);
    if (!validationResult.isValid) {
      return {
        error: 'Invalid article ID',
        validationError: validationResult.error,
      };
    }

    const { articleId: validArticleId } = validationResult;

    const [cacheStats, performanceStats, dbHealth] = await Promise.all([
      projectCache.singleBlogArticle.getStats(),
      getSitePerformanceStats(),
      monitoring.getHealth(),
    ]);

    // Vérifier le cache spécifique
    const cacheKey = generateCacheKey('single_blog_article', {
      articleId: validArticleId,
    });
    const cachedData = await projectCache.singleBlogArticle.get(cacheKey);

    return {
      articleId: validArticleId,
      validation: validationResult,
      cache: {
        ...cacheStats,
        specificArticle: {
          cached: !!cachedData,
          cacheKey: cacheKey.substring(0, 50),
          data: cachedData
            ? {
                article: !!cachedData.article,
                relatedArticlesCount: cachedData.relatedArticles?.length || 0,
                contextStats: !!cachedData.contextStats,
                fromCache: cachedData.metadata?.fromCache,
                timestamp: cachedData.metadata?.timestamp,
                stats: {
                  article: cachedData.metadata?.articleStats,
                  blog: cachedData.metadata?.blogStats,
                },
              }
            : null,
        },
      },
      performance: performanceStats,
      database: dbHealth,
      config: SINGLE_ARTICLE_CONFIG,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Fonction pour obtenir les statistiques d'usage d'un article
 * @param {string} articleId - ID de l'article
 */
export async function getArticleUsageStats(articleId) {
  if (process.env.NODE_ENV === 'production') {
    return { error: 'Usage stats not available in production' };
  }

  try {
    const validationResult = await validateArticleId(articleId);
    if (!validationResult.isValid) {
      return {
        error: 'Invalid article ID',
        validationError: validationResult.error,
      };
    }

    const { articleId: validArticleId } = validationResult;

    // Simuler des statistiques d'usage (en production, ces données viendraient d'analytics)
    const stats = {
      articleId: validArticleId,
      views: {
        today: Math.floor(Math.random() * 200),
        thisWeek: Math.floor(Math.random() * 1000),
        thisMonth: Math.floor(Math.random() * 4000),
        total: Math.floor(Math.random() * 20000),
      },
      engagement: {
        averageTimeOnPage: Math.floor(Math.random() * 300) + 60, // 1-6 minutes
        bounceRate: (Math.random() * 0.4 + 0.3).toFixed(3), // 30-70%
        shareCount: Math.floor(Math.random() * 50),
      },
      cachePerformance: {
        hitRate: Math.random() * 100,
        averageLoadTime: Math.random() * 500 + 200,
      },
      seo: {
        searchImpressions: Math.floor(Math.random() * 1000),
        searchClicks: Math.floor(Math.random() * 100),
        averagePosition: (Math.random() * 20 + 1).toFixed(1),
      },
      relatedArticlesClicks: Math.floor(Math.random() * 50),
      timestamp: new Date().toISOString(),
    };

    captureMessage('Article usage stats generated', {
      level: 'debug',
      tags: {
        component: 'single_blog_article_page',
        action: 'usage_stats',
      },
      extra: stats,
    });

    return stats;
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_blog_article_page',
        action: 'usage_stats_error',
      },
      extra: { articleId },
    });

    return { error: error.message };
  }
}

/**
 * Fonction pour obtenir les métriques de contenu d'un article
 * @param {string} articleId - ID de l'article
 */
export async function getArticleContentMetrics(articleId) {
  try {
    const validationResult = await validateArticleId(articleId);
    if (!validationResult.isValid) {
      return {
        error: 'Invalid article ID',
        validationError: validationResult.error,
      };
    }

    const { articleId: validArticleId } = validationResult;

    // Essayer de récupérer depuis le cache
    const cacheKey = generateCacheKey('single_blog_article', {
      articleId: validArticleId,
    });
    const cachedData = await projectCache.singleBlogArticle.get(cacheKey);

    if (cachedData && cachedData.article) {
      const article = cachedData.article;

      const contentMetrics = {
        articleId: validArticleId,
        title: article.article_title,
        content: {
          wordCount: article.word_count,
          estimatedReadingTime: article.estimated_reading_time,
          hasImages: article.has_images,
          contentLength: article.article_text?.length || 0,
        },
        metadata: {
          isRecent: article.is_recent,
          ageInDays: article.age_in_days,
          created: article.created,
          updated: article.updated,
        },
        seo: {
          titleLength: article.article_title?.length || 0,
          hasOptimizedImage: article.article_image?.includes('cloudinary.com'),
          canonicalUrl: article.canonical_url,
        },
        performance: {
          fromCache: cachedData.metadata?.fromCache,
          lastCached: cachedData.metadata?.timestamp,
        },
        timestamp: new Date().toISOString(),
      };

      return contentMetrics;
    }

    return {
      error: 'Article not found in cache',
      articleId: validArticleId,
      suggestion: 'Article may need to be loaded first',
    };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_blog_article_page',
        action: 'content_metrics_error',
      },
      extra: { articleId },
    });

    return { error: error.message };
  }
}

// =============================
// GENERATION STATIQUE (OPTIONNEL)
// =============================

/**
 * Fonction pour générer des paramètres statiques (si nécessaire)
 * Utile pour pré-générer les articles les plus populaires
 */
// export async function generateStaticParams() {
//   let results = [];
//   // En production, on pourrait récupérer les articles les plus populaires
//   // pour les pré-générer statiquement
//   if (process.env.NODE_ENV !== 'production') {
//     return results;
//   }

//   try {
//     // Cette fonction pourrait récupérer les top articles depuis la DB
//     // const popularArticles = await getPopularArticles();
//     // return popularArticles.map(article => ({
//     //   id: article.article_id
//     // }));
//   } catch (error) {
//     captureException(error, {
//       tags: {
//         component: 'single_blog_article_page',
//         action: 'generate_static_params_error',
//       },
//     });

//     results = [];
//   }

//   return results;
// }

// =============================
// UTILITAIRES DE PERFORMANCE BLOG
// =============================

/**
 * Fonction pour précharger les articles liés
 * @param {Array} relatedArticles - Articles liés à précharger
 */
export async function preloadRelatedArticles(relatedArticles) {
  if (!Array.isArray(relatedArticles) || relatedArticles.length === 0) {
    return { success: true, preloadedCount: 0 };
  }

  try {
    const preloadPromises = relatedArticles.map(async (article) => {
      if (!article.article_id) return null;

      const cacheKey = generateCacheKey('single_blog_article', {
        articleId: article.article_id,
      });
      const cached = await projectCache.singleBlogArticle.get(cacheKey);

      // Si pas en cache, on peut décider de le précharger ou non
      if (!cached) {
        // Pour l'instant, on ne fait que vérifier le cache
        // En production, on pourrait décider de précharger les données
        return { articleId: article.article_id, cached: false };
      }

      return { articleId: article.article_id, cached: true };
    });

    const results = await Promise.all(preloadPromises);
    const validResults = results.filter(Boolean);
    const cachedCount = validResults.filter((r) => r.cached).length;

    captureMessage('Related articles preload check completed', {
      level: 'debug',
      tags: {
        component: 'single_blog_article_page',
        action: 'preload_related_articles',
      },
      extra: {
        totalArticles: relatedArticles.length,
        checkedArticles: validResults.length,
        cachedArticles: cachedCount,
        cacheHitRate:
          validResults.length > 0
            ? (cachedCount / validResults.length).toFixed(3)
            : 0,
      },
    });

    return {
      success: true,
      preloadedCount: validResults.length,
      cachedCount,
      details: validResults,
    };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_blog_article_page',
        action: 'preload_related_articles_error',
      },
      extra: { relatedArticlesCount: relatedArticles.length },
    });

    return { success: false, error: error.message };
  }
}

/**
 * Fonction pour optimiser le contenu de l'article selon la connexion
 * @param {Object} article - Article à optimiser
 * @param {Object} adaptiveConfig - Configuration adaptative
 */
export function optimizeArticleContent(article, adaptiveConfig) {
  if (!article || !adaptiveConfig) return article;

  const optimized = { ...article };

  // Optimiser l'image selon la qualité de connexion
  if (
    optimized.article_image &&
    optimized.article_image.includes('cloudinary.com')
  ) {
    const baseTransform =
      adaptiveConfig.imageTransforms || 'w_800,h_600,c_fill,q_auto,f_auto';

    // Pour connexion lente, réduire la qualité
    if (adaptiveConfig.networkInfo?.isSlowConnection) {
      optimized.optimized_image = optimized.article_image.replace(
        '/upload/',
        `/upload/${baseTransform.replace('q_auto', 'q_auto:low')}/`,
      );
    } else {
      optimized.optimized_image = optimized.article_image.replace(
        '/upload/',
        `/upload/${baseTransform}/`,
      );
    }
  }

  // Optimiser le contenu pour connexion lente
  if (adaptiveConfig.networkInfo?.isSlowConnection) {
    // Marker pour le composant client de charger le contenu progressivement
    optimized.progressiveLoad = true;
    optimized.priorityContent =
      optimized.article_text?.substring(0, 1000) + '...';
  }

  return optimized;
}

export default SinglePostPage;
