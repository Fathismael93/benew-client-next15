// app/blog/page.jsx
// Server Component optimisé pour la liste des articles de blog
// Next.js 15 + PostgreSQL + Cache simplifié + Monitoring essentiel

import { Suspense } from 'react';

import ListBlog from '@/components/blog/ListBlog';
import { getClient } from '@/backend/dbConnect';
import { captureException, captureMessage } from '../../instrumentation';
import ListBlogSkeleton from '@/components/blog/skeletons/ListBlogSkeleton';

// Configuration simplifiée mais robuste pour blog
const CONFIG = {
  cache: {
    revalidate: 180, // 3 minutes - plus fréquent pour blog
  },
  performance: {
    slowQueryThreshold: 1000, // Blog = plus sensible aux performances
  },
};

// Fonction principale simplifiée mais complète
async function getBlogArticles() {
  const startTime = performance.now();

  try {
    const client = await getClient();

    try {
      // Query directe et simple avec optimisations image
      const result = await client.query(`
        SELECT 
          article_id, 
          article_title, 
          article_image, 
          TO_CHAR(article_created, 'DD/MM/YYYY') as created,
          article_created as created_raw
        FROM admin.articles 
        WHERE is_active = true 
        ORDER BY article_created DESC, article_id DESC
      `);

      const queryDuration = performance.now() - startTime;

      // Log uniquement si vraiment lent
      if (queryDuration > CONFIG.performance.slowQueryThreshold) {
        captureMessage('Slow blog query detected', {
          level: 'warning',
          tags: { component: 'blog_page' },
          extra: {
            duration: queryDuration,
            articlesCount: result.rows.length,
          },
        });
      }

      // Enrichissement simple des articles
      const enrichedArticles = result.rows.map((article) => ({
        ...article,
        canonical_url: `/blog/${article.article_id}`,
        optimized_image: article.article_image.includes('cloudinary.com')
          ? article.article_image.replace(
              '/upload/',
              '/upload/w_400,h_300,c_fill,q_auto:low,f_auto/',
            )
          : article.article_image,
      }));

      return {
        articles: enrichedArticles,
        success: true,
      };
    } finally {
      client.release();
    }
  } catch (error) {
    // Capture d'erreur simplifiée mais efficace
    captureException(error, {
      tags: {
        component: 'blog_page',
        error_type: 'database_error',
      },
    });

    return {
      articles: [],
      success: false,
      error: error.message,
    };
  }
}

// Composant principal épuré
export default async function BlogPage() {
  const data = await getBlogArticles();

  // Gestion d'erreur simple
  if (!data.success) {
    // En production, on affiche une page d'erreur propre
    if (process.env.NODE_ENV === 'production') {
      return (
        <div className="blog-error-fallback">
          <h1>Blog temporairement indisponible</h1>
          <p>Veuillez réessayer dans quelques instants.</p>
        </div>
      );
    }

    // En dev, on affiche l'erreur
    return (
      <div className="blog-error-fallback">
        <h1>Erreur de chargement du blog</h1>
        <p>Impossible de charger les articles.</p>
        <pre>{data.error}</pre>
      </div>
    );
  }

  // Si pas d'articles (cas valide pour un blog)
  if (!data.articles || data.articles.length === 0) {
    return (
      <div className="blog-empty-state">
        <h1>Aucun article disponible</h1>
        <p>Revenez bientôt pour découvrir nos nouveaux articles.</p>
      </div>
    );
  }

  // Rendu normal avec Suspense pour UX
  return (
    <Suspense fallback={<ListBlogSkeleton />}>
      <ListBlog posts={data.articles} />
    </Suspense>
  );
}

// Metadata pour SEO blog
export const metadata = {
  title: 'Blog Benew - Articles et Actualités',
  description:
    'Découvrez nos derniers articles sur le développement web, les templates et les applications mobiles.',
  keywords: [
    'blog développement web',
    'articles techniques',
    'actualités tech',
    'templates web',
    'applications mobiles',
    'Benew',
    'Djibouti',
  ],
  openGraph: {
    title: 'Blog Benew - Articles et Actualités',
    description: 'Articles et actualités sur le développement web et mobile',
    type: 'website',
    locale: 'fr_FR',
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/blog`,
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL}/blog`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Configuration Next.js 15 pour cache ISR
export const revalidate = 180; // ISR de 3 minutes

// Dynamic pour contenus fréquemment mis à jour
export const dynamic = 'force-static'; // Optimisé pour performance
