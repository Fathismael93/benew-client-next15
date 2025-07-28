// app/blog/[id]/page.jsx
// Server Component optimisé pour un article de blog spécifique
// Next.js 15 + PostgreSQL + Cache + Monitoring essentiel

import { Suspense } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import SinglePost from '@/components/blog/SinglePost';
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
import { articleIdSchema } from '@/utils/schemas/schema';

// Configuration simplifiée
const CONFIG = {
  cache: { ttl: 30 * 60 * 1000, entityType: 'single_blog_article' },
  database: { timeout: 8000, retryAttempts: 2 },
  performance: { slowQueryThreshold: 1000, alertThreshold: 2500 },
  rateLimiting: { enabled: true, preset: 'BLOG_API' },
  validation: { strictMode: true },
};

// Validation de l'ID
async function validateArticleId(articleId) {
  try {
    const validation = await articleIdSchema.validate(
      { id: articleId },
      {
        strict: CONFIG.validation.strictMode,
        stripUnknown: true,
      },
    );

    return { isValid: true, articleId: validation.id };
  } catch (validationError) {
    return { isValid: false, error: validationError.message };
  }
}

// Sanitisation du contenu
function sanitizeArticleContent(content) {
  if (!content || typeof content !== 'string') return '';

  const hasBasicHTMLStructure = /<[^>]+>/.test(content);
  const isReasonableLength = content.length > 10 && content.length < 500000;

  if (!hasBasicHTMLStructure || !isReasonableLength) {
    captureMessage('Article content validation issue', {
      level: 'warning',
      tags: { component: 'single_blog_article_page', content_issue: true },
      extra: { hasHTML: hasBasicHTMLStructure, contentLength: content.length },
    });
  }

  return content.trim();
}

// Requêtes optimisées
function getArticleDataQuery(articleId) {
  return {
    mainArticleQuery: {
      query: `
        SELECT 
          article_id, article_title, article_text, article_image,
          TO_CHAR(article_created, 'DD/MM/YYYY') as created,
          article_created as created_raw,
          TO_CHAR(article_updated, 'DD/MM/YYYY') as updated,
          article_updated as updated_raw,
          (SELECT COUNT(*) FROM admin.articles WHERE is_active = true) as total_active_articles
        FROM admin.articles 
        WHERE article_id = $1 AND is_active = true
      `,
      params: [articleId],
    },
    relatedArticlesQuery: {
      query: `
        SELECT 
          article_id, article_title, article_image,
          TO_CHAR(article_created, 'DD/MM/YYYY') as created,
          article_created as created_raw
        FROM admin.articles 
        WHERE article_id != $1 AND is_active = true 
        ORDER BY article_created DESC 
        LIMIT 4
      `,
      params: [articleId],
    },
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
    existenceCheckQuery: {
      query: `SELECT article_id, is_active, article_created FROM admin.articles WHERE article_id = $1`,
      params: [articleId],
    },
  };
}

// Enrichissement des données
function enrichArticleData(article) {
  if (!article) return null;

  const sanitizedContent = sanitizeArticleContent(article.article_text);

  return {
    ...article,
    article_text: sanitizedContent,
    canonical_url: `/blog/${article.article_id}`,
    optimized_image: article.article_image?.includes('cloudinary.com')
      ? article.article_image.replace(
          '/upload/',
          '/upload/w_800,h_600,c_fill,q_auto,f_auto/',
        )
      : article.article_image,
    cache_key: `single_article_${article.article_id}`,
    entity_type: 'single_blog_article',
    estimated_reading_time: Math.ceil(
      sanitizedContent.replace(/<[^>]*>/g, '').split(' ').length / 200,
    ),
    word_count: sanitizedContent.replace(/<[^>]*>/g, '').split(' ').length,
    has_images: /<img\s+[^>]*src=/i.test(sanitizedContent),
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
}

// Fonction principale de récupération
async function getSingleArticleWithOptimizations(articleId) {
  const startTime = performance.now();
  const cacheKey = generateCacheKey('single_blog_article', { articleId });

  try {
    // Vérifier le cache
    const cachedResult = await projectCache.singleBlogArticle.get(cacheKey);
    if (cachedResult) {
      return {
        ...cachedResult,
        metadata: { ...cachedResult.metadata, fromCache: true },
      };
    }

    // Récupération depuis la DB
    const client = await getClient();
    let articleData = null;

    try {
      const queries = getArticleDataQuery(articleId);
      const queryStartTime = performance.now();

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

      // Vérifications d'existence et d'activité
      if (existenceResult.rows.length === 0) {
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

      const existenceData = existenceResult.rows[0];
      if (!existenceData.is_active) {
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

      if (mainArticleResult.rows.length === 0) {
        captureMessage('Blog article data not found despite existence', {
          level: 'error',
          tags: {
            component: 'single_blog_article_page',
            data_inconsistency: true,
          },
          extra: { articleId, queryDuration },
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
          },
        };
      }

      const rawArticle = mainArticleResult.rows[0];
      const relatedArticles = relatedArticlesResult.rows;
      const contextStats = contextStatsResult.rows[0];

      const enrichedArticle = enrichArticleData(rawArticle);

      // Log seulement si très lent
      if (queryDuration > CONFIG.performance.slowQueryThreshold) {
        captureMessage('Slow single blog article query detected', {
          level: 'warning',
          tags: {
            component: 'single_blog_article_page',
            performance_issue: 'slow_query',
          },
          extra: {
            articleId,
            duration: queryDuration,
            wordCount: enrichedArticle?.word_count,
          },
        });
      }

      if (queryDuration > CONFIG.performance.alertThreshold) {
        captureMessage('Critical: Very slow single blog article query', {
          level: 'error',
          tags: {
            component: 'single_blog_article_page',
            performance_issue: 'critical_slow_query',
          },
          extra: {
            articleId,
            duration: queryDuration,
            threshold: CONFIG.performance.alertThreshold,
          },
        });
      }

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

      // Mettre en cache
      await projectCache.singleBlogArticle.set(cacheKey, articleData, {
        ttl: CONFIG.cache.ttl,
      });

      return articleData;
    } finally {
      client.release();
    }
  } catch (error) {
    const errorDuration = performance.now() - startTime;

    if (/postgres|pg|database|db|connection/i.test(error.message)) {
      captureDatabaseError(error, {
        table: 'admin.articles',
        operation: 'select_single_blog_article_with_context',
        tags: { component: 'single_blog_article_page' },
        extra: { articleId, duration: errorDuration },
      });
    } else {
      captureException(error, {
        tags: {
          component: 'single_blog_article_page',
          error_type: 'single_article_fetch_error',
        },
        extra: { articleId, duration: errorDuration },
      });
    }

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
      },
    };
  }
}

// Version optimisée
const getOptimizedSingleArticle = optimizeApiCall(
  getSingleArticleWithOptimizations,
  {
    entityType: 'single_blog_article',
    cacheTTL: CONFIG.cache.ttl,
    throttleDelay: 100,
    retryAttempts: CONFIG.database.retryAttempts,
    retryDelay: 1500,
  },
);

// Composant principal
async function SinglePostPage({ params }) {
  const requestStartTime = performance.now();
  const { id: rawArticleId } = await params;

  try {
    // Validation de l'ID
    const validationResult = await validateArticleId(rawArticleId);
    if (!validationResult.isValid) {
      return notFound();
    }

    const { articleId } = validationResult;

    // Rate Limiting
    if (CONFIG.rateLimiting.enabled) {
      const headersList = headers();
      const rateLimitCheck = await limitBenewAPI('blog')({
        headers: headersList,
        url: `/blog/${articleId}`,
        method: 'GET',
      });

      if (rateLimitCheck) {
        return notFound();
      }
    }

    const adaptiveConfig = getAdaptiveSiteConfig();
    const articleData = await getOptimizedSingleArticle(articleId);

    // Vérifications des résultats
    if (
      !articleData ||
      !articleData.article ||
      articleData.metadata?.articleExists === false
    ) {
      return notFound();
    }

    if (articleData.metadata?.isActive === false) {
      return notFound();
    }

    if (articleData.metadata?.error) {
      return notFound();
    }

    const totalDuration = performance.now() - requestStartTime;

    // Log seulement si très lent
    if (totalDuration > 2500) {
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
          fromCache: articleData.metadata?.fromCache,
        },
      });
    }

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
    captureException(error, {
      tags: {
        component: 'single_blog_article_page',
        error_type: 'page_render_error',
      },
      extra: { rawArticleId },
    });

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

// Skeleton component
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

// Metadata
export async function generateMetadata({ params }) {
  const { id: rawArticleId } = await params;

  try {
    const validationResult = await validateArticleId(rawArticleId);
    if (!validationResult.isValid) {
      return {
        title: 'Article non trouvé - Blog Benew',
        description: "L'article demandé n'existe pas ou n'est plus disponible.",
      };
    }

    const { articleId } = validationResult;
    const cacheKey = generateCacheKey('single_blog_article', { articleId });
    const cachedData = await projectCache.singleBlogArticle.get(cacheKey);

    if (cachedData && cachedData.article) {
      const article = cachedData.article;
      let description = article.article_text
        ? article.article_text.replace(/<[^>]*>/g, '').substring(0, 160) + '...'
        : `Lisez l'article "${article.article_title}" sur le blog Benew.`;

      return {
        title: `${article.article_title} - Blog Benew`,
        description,
        robots: { index: true, follow: true },
        alternates: { canonical: `/blog/${articleId}` },
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

    return {
      title: 'Article - Blog Benew',
      description: 'Découvrez cet article sur le blog Benew.',
      robots: { index: true, follow: true },
      alternates: { canonical: `/blog/${articleId}` },
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

// Utilitaires d'invalidation
export async function invalidateSingleArticleCache(articleId) {
  try {
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
    const listInvalidatedCount = invalidateProjectCache('blog_article');

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

export async function invalidateRelatedArticlesCache(articleId) {
  try {
    const validation = await articleIdSchema.validate({ id: articleId });
    if (!validation) {
      throw new Error(`Invalid article ID: ${articleId}`);
    }

    const mainArticleInvalidated = invalidateProjectCache(
      'single_blog_article',
      validation.id,
    );
    const articlesListInvalidated = invalidateProjectCache('blog_article');
    const totalInvalidated = mainArticleInvalidated + articlesListInvalidated;

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

export async function invalidateAllBlogCache() {
  try {
    const singleArticlesInvalidated = invalidateProjectCache(
      'single_blog_article',
    );
    const articlesListInvalidated = invalidateProjectCache('blog_article');
    const totalInvalidated =
      singleArticlesInvalidated + articlesListInvalidated;

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

// Optimisation du contenu selon la connexion
export function optimizeArticleContent(article, adaptiveConfig) {
  if (!article || !adaptiveConfig) return article;

  const optimized = { ...article };

  if (
    optimized.article_image &&
    optimized.article_image.includes('cloudinary.com')
  ) {
    const baseTransform =
      adaptiveConfig.imageTransforms || 'w_800,h_600,c_fill,q_auto,f_auto';

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

  if (adaptiveConfig.networkInfo?.isSlowConnection) {
    optimized.progressiveLoad = true;
    optimized.priorityContent =
      optimized.article_text?.substring(0, 1000) + '...';
  }

  return optimized;
}

export default SinglePostPage;
