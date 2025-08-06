// app/blog/page.jsx
// Server Component optimisé pour la liste des articles de blog
// Next.js 15 + PostgreSQL + Cache + Monitoring essentiel

import { Suspense } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import ListBlog from '@/components/blog/ListBlog';
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
} from '../../instrumentation';
import { optimizeApiCall, getAdaptiveSiteConfig } from '@/utils/performance';
import { limitBenewAPI } from '@/backend/rateLimiter';

// Configuration simplifiée
const CONFIG = {
  cache: { ttl: 5 * 60 * 1000, entityType: 'blog_article' },
  database: { timeout: 6000, retryAttempts: 2 },
  performance: { slowQueryThreshold: 800 },
  rateLimiting: { enabled: true, preset: 'BLOG_API' },
};

// Requête optimisée
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

// Validation et enrichissement
function validateAndEnrichArticles(articles) {
  if (!Array.isArray(articles)) return [];

  return articles
    .filter(
      (article) =>
        article.article_id &&
        article.article_title &&
        article.article_image &&
        article.created,
    )
    .map((article) => ({
      ...article,
      canonical_url: `/blog/${article.article_id}`,
      optimized_image: article.article_image.includes('cloudinary.com')
        ? article.article_image.replace(
            '/upload/',
            '/upload/w_400,h_300,c_fill,q_auto:low,f_auto/',
          )
        : article.article_image,
      cache_key: `article_${article.article_id}`,
      entity_type: 'blog_article',
    }));
}

// Fonction principale de récupération
async function getBlogArticlesWithOptimizations() {
  const startTime = performance.now();
  const cacheKey = generateCacheKey('blog_articles_list', {});

  try {
    // Vérifier le cache
    const cachedResult = await projectCache.blogArticles.get(cacheKey);
    if (cachedResult) {
      return {
        ...cachedResult,
        metadata: { ...cachedResult.metadata, fromCache: true },
      };
    }

    // Récupération depuis la DB
    const client = await getClient();
    let articles = [];

    try {
      const articlesQuery = getBlogArticlesQuery();
      const articlesResult = await client.query(
        articlesQuery.query,
        articlesQuery.params,
      );

      const rawArticles = articlesResult.rows;
      const queryDuration = performance.now() - startTime;

      // Log seulement si lent
      if (queryDuration > CONFIG.performance.slowQueryThreshold) {
        captureMessage('Slow blog query detected', {
          level: 'warning',
          tags: { component: 'blog_page', performance_issue: 'slow_query' },
          extra: { duration: queryDuration, articlesCount: rawArticles.length },
        });
      }

      articles = validateAndEnrichArticles(rawArticles);

      const result = {
        articles,
        metadata: {
          queryDuration,
          fromCache: false,
          timestamp: new Date().toISOString(),
          resultCount: articles.length,
          validationPassed: articles.length === rawArticles.length,
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

      // Mettre en cache
      await projectCache.blogArticles.set(cacheKey, result, {
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
        table: 'admin.articles',
        operation: 'select_blog_articles_list',
        tags: { component: 'blog_page' },
        extra: { duration: errorDuration },
      });
    } else {
      captureException(error, {
        tags: { component: 'blog_page', error_type: 'blog_fetch_error' },
        extra: { duration: errorDuration },
      });
    }

    return {
      articles: [],
      metadata: {
        queryDuration: errorDuration,
        fromCache: false,
        timestamp: new Date().toISOString(),
        resultCount: 0,
        error: true,
        errorMessage: 'Failed to load blog articles',
      },
    };
  }
}

// Version optimisée avec performance
const getOptimizedBlogArticles = optimizeApiCall(
  getBlogArticlesWithOptimizations,
  {
    entityType: 'blog_article',
    cacheTTL: CONFIG.cache.ttl,
    throttleDelay: 200,
    retryAttempts: CONFIG.database.retryAttempts,
    retryDelay: 1000,
  },
);

// Composant principal
async function BlogPage() {
  const requestStartTime = performance.now();

  try {
    // Rate Limiting
    if (CONFIG.rateLimiting.enabled) {
      const headersList = headers();
      const rateLimitCheck = await limitBenewAPI('blog')({
        headers: headersList,
        url: '/blog',
        method: 'GET',
      });

      if (rateLimitCheck) {
        return notFound();
      }
    }

    const adaptiveConfig = getAdaptiveSiteConfig();
    const blogData = await getOptimizedBlogArticles();

    if (!blogData || (!blogData.articles && blogData.metadata?.error)) {
      return notFound();
    }

    const totalDuration = performance.now() - requestStartTime;

    // Log seulement si très lent
    if (totalDuration > 1500) {
      captureMessage('Slow blog page load', {
        level: 'warning',
        tags: { component: 'blog_page', performance_issue: 'slow_page_load' },
        extra: {
          totalDuration,
          queryDuration: blogData.metadata?.queryDuration,
          articlesCount: blogData.articles?.length,
          fromCache: blogData.metadata?.fromCache,
        },
      });
    }

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
    captureException(error, {
      tags: { component: 'blog_page', error_type: 'page_render_error' },
    });

    return (
      <div className="blog-error-fallback">
        <h1>Blog temporairement indisponible</h1>
        <p>Veuillez réessayer dans quelques instants.</p>
      </div>
    );
  }
}

// Skeleton component
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

// Metadata
export async function generateMetadata() {
  return {
    title: 'Blog Benew - Articles et Actualités',
    description:
      'Découvrez nos derniers articles sur le développement web, les templates et les applications mobiles.',
    robots: { index: true, follow: true },
    alternates: { canonical: '/blog' },
    openGraph: {
      title: 'Blog Benew',
      description: 'Articles et actualités sur le développement web et mobile',
      type: 'website',
      locale: 'fr_FR',
    },
  };
}

// Utilitaires d'invalidation
export async function invalidateBlogCache(articleId = null) {
  try {
    const invalidatedCount = invalidateProjectCache('blog_article', articleId);
    return { success: true, invalidatedCount };
  } catch (error) {
    captureException(error, {
      tags: { component: 'blog_page', action: 'cache_invalidation_error' },
      extra: { articleId },
    });
    return { success: false, error: error.message };
  }
}

export async function invalidateSpecificArticle(articleId) {
  if (!articleId) {
    throw new Error('Article ID is required for specific invalidation');
  }

  try {
    await invalidateBlogCache();

    const singleArticleKey = generateCacheKey('single_blog_article', {
      id: articleId,
    });
    await projectCache.singleBlogArticle.delete(singleArticleKey);

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

// Statistiques simplifiées
export async function getBlogStats() {
  try {
    const cacheKey = generateCacheKey('blog_stats', {});
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

      await projectCache.blogArticles.set(`${cacheKey}_stats`, enrichedStats, {
        ttl: 10 * 60 * 1000,
      });

      return enrichedStats;
    } finally {
      client.release();
    }
  } catch (error) {
    captureException(error, {
      tags: { component: 'blog_page', action: 'get_blog_stats_error' },
    });

    return {
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

export default BlogPage;
