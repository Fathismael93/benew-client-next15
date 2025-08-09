// app/blog/[id]/page.jsx
// Server Component optimisé pour un article de blog spécifique
// Next.js 15 + PostgreSQL + Monitoring essentiel

import { Suspense } from 'react';
import { notFound } from 'next/navigation';

import SinglePost from '@/components/blog/SinglePost';
import { getClient } from '@/backend/dbConnect';
import { captureException, captureMessage } from '../../../instrumentation';

// Configuration simple et efficace
const CONFIG = {
  cache: {
    revalidate: 180, // 3 minutes - blog plus dynamique
  },
  performance: {
    slowQueryThreshold: 1000, // Blog = expérience lecture sensible
  },
};

// Validation basique de l'ID
function validateArticleId(articleId) {
  if (!articleId || typeof articleId !== 'string' || articleId.length === 0) {
    return { isValid: false };
  }
  return { isValid: true, articleId };
}

// Enrichissement minimal mais utile pour le blog
function enrichArticleData(article) {
  if (!article) return null;

  const cleanText = article.article_text?.replace(/<[^>]*>/g, '') || '';

  return {
    ...article,
    canonical_url: `/blog/${article.article_id}`,
    // Optimisation Cloudinary pour blog
    optimized_image: article.article_image?.includes('cloudinary.com')
      ? article.article_image.replace(
          '/upload/',
          '/upload/w_800,h_600,c_fill,q_auto,f_auto/',
        )
      : article.article_image,
    // Métriques de lecture pour UX
    estimated_reading_time: Math.ceil(cleanText.split(' ').length / 200),
    word_count: cleanText.split(' ').length,
    has_images: /<img\s+[^>]*src=/i.test(article.article_text || ''),
  };
}

// Fonction principale épurée
async function getArticleData(articleId) {
  const startTime = performance.now();

  try {
    const client = await getClient();

    try {
      // Exécuter les requêtes en parallèle pour performance optimale
      const [articleResult, relatedResult] = await Promise.all([
        // 1. Article principal avec stats contextuelles
        client.query(
          `SELECT 
            article_id,
            article_title,
            article_text,
            article_image,
            TO_CHAR(article_created, 'DD/MM/YYYY') as created,
            created as created_raw,
            TO_CHAR(article_updated, 'DD/MM/YYYY') as updated,
            updated as updated_raw,
            (SELECT COUNT(*) FROM admin.articles WHERE is_active = true) as total_active_articles
          FROM admin.articles 
          WHERE article_id = $1 AND is_active = true`,
          [articleId],
        ),

        // 2. Articles similaires
        client.query(
          `SELECT 
            article_id,
            article_title,
            article_image,
            TO_CHAR(article_created, 'DD/MM/YYYY') as created
          FROM admin.articles 
          WHERE article_id != $1 AND is_active = true 
          ORDER BY article_created DESC 
          LIMIT 4`,
          [articleId],
        ),
      ]);

      const queryDuration = performance.now() - startTime;

      // Log uniquement si lent
      if (queryDuration > CONFIG.performance.slowQueryThreshold) {
        captureMessage('Slow single blog article query', {
          level: 'warning',
          tags: { component: 'single_blog_page' },
          extra: {
            articleId,
            duration: queryDuration,
            relatedCount: relatedResult.rows.length,
          },
        });
      }

      // Vérifier si l'article existe
      if (articleResult.rows.length === 0) {
        return {
          article: null,
          relatedArticles: [],
          success: false,
        };
      }

      const rawArticle = articleResult.rows[0];
      const enrichedArticle = enrichArticleData(rawArticle);

      return {
        article: enrichedArticle,
        relatedArticles: relatedResult.rows,
        success: true,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'single_blog_page',
        error_type: 'database_error',
      },
      extra: { articleId },
    });

    return {
      article: null,
      relatedArticles: [],
      success: false,
      error: error.message,
    };
  }
}

// Composant principal simplifié
export default async function SingleBlogPage({ params }) {
  const { id: articleId } = await params;

  // Validation basique
  const validation = validateArticleId(articleId);
  if (!validation.isValid) {
    notFound();
  }

  // Récupérer les données
  const data = await getArticleData(validation.articleId);

  // Gestion des erreurs et article non trouvé
  if (!data.success || !data.article) {
    notFound();
  }

  // Rendu normal avec Suspense
  return (
    <Suspense fallback={<SingleBlogPageSkeleton />}>
      <SinglePost
        article={data.article}
        relatedArticles={data.relatedArticles}
        context={{
          articleId: validation.articleId,
        }}
      />
    </Suspense>
  );
}

// Skeleton component simple et efficace
function SingleBlogPageSkeleton() {
  return (
    <div className="single-blog-skeleton">
      {/* Header skeleton */}
      <div className="skeleton-header">
        <div className="skeleton-title-large"></div>
        <div className="skeleton-meta">
          <div className="skeleton-date"></div>
          <div className="skeleton-reading-time"></div>
        </div>
        <div className="skeleton-image-hero"></div>
      </div>

      {/* Content skeleton */}
      <div className="skeleton-content">
        <div className="skeleton-text-block"></div>
        <div className="skeleton-text-block"></div>
        <div className="skeleton-text-block"></div>
        <div className="skeleton-image-content"></div>
        <div className="skeleton-text-block"></div>
      </div>

      {/* Related articles skeleton */}
      <div className="skeleton-related">
        <div className="skeleton-title"></div>
        <div className="skeleton-grid">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-image"></div>
              <div className="skeleton-card-content">
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

// Génération dynamique des metadata
export async function generateMetadata({ params }) {
  const { id: articleId } = await params;

  // Validation basique
  const validation = validateArticleId(articleId);
  if (!validation.isValid) {
    return {
      title: 'Article non trouvé - Blog Benew',
      description: "L'article demandé n'existe pas ou n'est plus disponible.",
    };
  }

  try {
    const client = await getClient();
    try {
      const result = await client.query(
        `SELECT 
          article_title,
          article_text,
          article_image,
          created,
          updated
        FROM admin.articles 
        WHERE article_id = $1 AND is_active = true`,
        [validation.articleId],
      );

      if (result.rows.length > 0) {
        const article = result.rows[0];
        const cleanText = article.article_text?.replace(/<[^>]*>/g, '') || '';
        const description =
          cleanText.length > 160
            ? cleanText.substring(0, 160) + '...'
            : `Lisez l'article "${article.article_title}" sur le blog Benew.`;

        return {
          title: `${article.article_title} - Blog Benew`,
          description,
          keywords: [
            article.article_title,
            'blog Benew',
            'article',
            'Djibouti',
          ],
          robots: { index: true, follow: true },
          alternates: {
            canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/blog/${validation.articleId}`,
          },
          openGraph: {
            title: `${article.article_title} - Blog Benew`,
            description,
            images: article.article_image ? [article.article_image] : [],
            type: 'article',
            locale: 'fr_FR',
            publishedTime: article.created,
            modifiedTime: article.updated,
            url: `${process.env.NEXT_PUBLIC_SITE_URL}/blog/${validation.articleId}`,
          },
        };
      }
    } finally {
      client.release();
    }
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    // Fallback metadata si erreur
  }

  // Metadata par défaut
  return {
    title: 'Article - Blog Benew',
    description: 'Découvrez cet article sur le blog Benew.',
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/blog/${validation.articleId}`,
    },
  };
}

// Configuration ISR Next.js 15
export const revalidate = 180; // 3 minutes pour blog

// Force static pour performance optimale
export const dynamic = 'force-static';
