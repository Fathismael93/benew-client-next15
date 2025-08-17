'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { captureMessage } from '@/instrumentation';
import { trackEvent } from '@/utils/analytics';
import './not-found.scss';

/**
 * Page 404 pour la route /blog/[id]
 * Gère le cas où un article de blog spécifique n'existe pas
 * Production-ready avec suggestions intelligentes
 */
export default function BlogArticleNotFound() {
  const params = useParams();
  const articleId = params?.id;

  useEffect(() => {
    // Capture dans Sentry
    captureMessage('404 - Blog article not found', {
      level: 'info',
      tags: {
        component: 'blog_article_not_found',
        page_type: 'blog_article',
        error_type: '404',
        article_id: articleId || 'unknown',
      },
      extra: {
        articleId,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        referrer:
          typeof document !== 'undefined' ? document.referrer : 'unknown',
      },
    });

    // Track dans Analytics
    trackEvent('page_not_found', {
      event_category: 'errors',
      event_label: '404_blog_article',
      page_path: `/blog/${articleId}`,
      article_id: articleId,
    });

    // Log en dev
    if (process.env.NODE_ENV === 'development') {
      console.log('[BlogArticleNotFound] 404 for article:', articleId);
    }
  }, [articleId]);

  /**
   * Handler pour les liens avec tracking
   */
  const handleLinkClick = (destination, extra = {}) => {
    trackEvent('404_navigation', {
      event_category: 'errors',
      event_label: `404_to_${destination}`,
      from_page: 'blog_article',
      article_id: articleId,
      ...extra,
    });
  };

  return (
    <section className="first">
      <div className="blog-not-found-container">
        <div className="content-wrapper">
          {/* Icône spéciale blog */}
          <div className="blog-icon">📖</div>

          {/* Titre principal */}
          <h1 className="error-title">Article Introuvable</h1>

          {/* Badge de l'ID de l'article */}
          {articleId && (
            <div className="article-id-badge">Article : {articleId}</div>
          )}

          {/* Message explicatif */}
          <p className="error-message">
            Désolé, l&apos;article que vous recherchez n&apos;existe pas ou a
            peut-être été retiré de notre blog. Découvrez nos autres articles
            qui pourraient vous intéresser !
          </p>

          {/* Message d'encouragement */}
          <p className="error-submessage">
            Notre blog contient de nombreux articles passionnants sur le
            développement, les technologies et l&apos;entrepreneuriat.
          </p>

          {/* Boutons d'action */}
          <div className="button-group">
            <Link
              href="/blog"
              className="retry-button"
              onClick={() => handleLinkClick('blog_list')}
            >
              📋 Voir tous les articles
            </Link>

            <Link
              href="/"
              className="home-button"
              onClick={() => handleLinkClick('home')}
            >
              🏠 Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
