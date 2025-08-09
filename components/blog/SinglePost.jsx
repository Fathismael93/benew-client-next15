/* eslint-disable no-unused-vars */
'use client';

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { CldImage } from 'next-cloudinary';
import parse from 'html-react-parser';
import Link from 'next/link';
import './styling/singlePost/index.scss';
import { trackEvent } from '@/utils/analytics';
import PageTracker from '../analytics/PageTracker';

// Composant d'en-tête mémorisé
const ArticleHeader = memo(({ article, onImageClick }) => (
  <div className="article-header">
    <h1>{article.article_title}</h1>
    {article.article_image && (
      <CldImage
        priority
        src={article.article_image}
        alt="Article illustration"
        width={640}
        height={400}
        className="imageContainer"
        style={{ width: '100%', height: 'auto', maxHeight: '400px' }}
        onClick={() => onImageClick(article.article_image)}
      />
    )}
  </div>
));

ArticleHeader.displayName = 'ArticleHeader';

// Composant de contenu mémorisé
const ArticleContent = memo(({ article, onImageClick, contentRef }) => {
  // Options de parsing enrichi pour tracker les clics d'images
  const parseOptions = {
    replace: (domNode) => {
      if (domNode.name === 'img' && domNode.attribs?.src) {
        const originalSrc = domNode.attribs.src;
        return (
          <img
            {...domNode.attribs}
            onClick={() => onImageClick(originalSrc)}
            style={{ cursor: 'pointer' }}
            alt={domNode.attribs.alt || "Image de l'article"}
          />
        );
      }
    },
  };

  return (
    <div className="part" ref={contentRef}>
      {article.article_text && parse(article.article_text, parseOptions)}
    </div>
  );
});

ArticleContent.displayName = 'ArticleContent';

// Composant d'articles liés mémorisé
const RelatedArticles = memo(({ relatedArticles, onRelatedClick }) => {
  if (!relatedArticles || relatedArticles.length === 0) return null;

  return (
    <div className="related-articles">
      <h3>Articles similaires</h3>
      <div className="related-grid">
        {relatedArticles.map((relatedArticle) => (
          <Link
            key={relatedArticle.article_id}
            href={`/blog/${relatedArticle.article_id}`}
            className="related-card"
            onClick={() => onRelatedClick(relatedArticle)}
          >
            {relatedArticle.article_image && (
              <CldImage
                src={relatedArticle.article_image}
                alt={relatedArticle.article_title}
                width={200}
                height={130}
                className="related-image"
                loading="lazy"
                quality="auto"
                format="auto"
              />
            )}
            <div className="related-content">
              <h4>{relatedArticle.article_title}</h4>
              <span className="related-date">{relatedArticle.created}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
});

RelatedArticles.displayName = 'RelatedArticles';

// Composant principal simplifié
const SinglePost = ({ article, relatedArticles = [], context = {} }) => {
  const [readingProgress, setReadingProgress] = useState(0);
  const [hasStartedReading, setHasStartedReading] = useState(false);
  const [readingTracked, setReadingTracked] = useState(false);

  const articleContentRef = useRef(null);

  // Tracking de la vue initiale (une seule fois)
  useEffect(() => {
    if (context?.articleId && article?.article_title) {
      trackEvent('blog_article_view', {
        event_category: 'blog',
        event_label: article.article_title,
        article_id: context.articleId,
        article_title: article.article_title,
        word_count: article.word_count || 0,
        estimated_reading_time: article.estimated_reading_time || 0,
        has_images: article.has_images || false,
      });
    }
  }, []); // Dépendance vide intentionnelle

  // Tracking de lecture simplifié (seulement à 50%)
  useEffect(() => {
    if (!articleContentRef.current) return;

    const handleScroll = () => {
      const contentElement = articleContentRef.current;
      if (!contentElement) return;

      const contentTop = contentElement.offsetTop;
      const contentHeight = contentElement.offsetHeight;
      const windowHeight = window.innerHeight;
      const scrollTop = window.scrollY;

      // Calculer le progrès de lecture simplifié
      const contentBottom = contentTop + contentHeight;
      const readableTop = contentTop - windowHeight * 0.3;
      const readableBottom = contentBottom - windowHeight * 0.7;

      if (scrollTop >= readableTop && scrollTop <= readableBottom) {
        if (!hasStartedReading) {
          setHasStartedReading(true);

          trackEvent('article_reading_start', {
            event_category: 'engagement',
            event_label: 'reading_started',
            article_id: context?.articleId,
          });
        }

        const progress = Math.min(
          100,
          Math.max(
            0,
            ((scrollTop - readableTop) / (readableBottom - readableTop)) * 100,
          ),
        );

        setReadingProgress(progress);

        // Tracker seulement le milestone de 50% une fois
        if (progress >= 50 && !readingTracked) {
          setReadingTracked(true);

          trackEvent('article_reading_milestone', {
            event_category: 'engagement',
            event_label: 'halfway_read',
            article_id: context?.articleId,
            reading_progress: 50,
          });
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasStartedReading, readingTracked, context?.articleId]);

  // Handler pour les clics d'images
  const handleImageClick = useCallback(
    (imageSrc) => {
      trackEvent('article_image_click', {
        event_category: 'content_interaction',
        event_label: 'image_clicked',
        article_id: context?.articleId,
        reading_progress: Math.round(readingProgress),
      });
    },
    [context?.articleId, readingProgress],
  );

  // Handler pour les clics sur articles liés
  const handleRelatedClick = useCallback(
    (relatedArticle) => {
      trackEvent('related_article_click', {
        event_category: 'navigation',
        event_label: relatedArticle.article_title,
        source_article_id: context?.articleId,
        target_article_id: relatedArticle.article_id,
      });
    },
    [context?.articleId],
  );

  // Gestion de l'état vide
  if (!article || !article.article_title) {
    return (
      <article className="article-empty">
        <PageTracker
          pageName={`article_${context?.articleId}`}
          pageType="blog_article"
          sections={['article_error']}
        />
        <div className="post">
          <h1>Article non disponible</h1>
          <p>Cet article n&apos;est pas disponible pour le moment.</p>
          <Link href="/blog" className="back-link">
            Retour au blog
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article>
      <PageTracker
        pageName={`article_${context?.articleId}`}
        pageType="blog_article"
        sections={[
          'article_header',
          'article_content',
          'article_footer',
          'related_articles',
        ]}
      />

      <div className="post">
        <ArticleHeader article={article} onImageClick={handleImageClick} />

        <ArticleContent
          article={article}
          onImageClick={handleImageClick}
          contentRef={articleContentRef}
        />

        {article.created && (
          <div className="article-meta">
            <em>{`Publié le ${article.created}`}</em>
            {article.estimated_reading_time && (
              <span className="reading-time">
                {article.estimated_reading_time} min de lecture
              </span>
            )}
          </div>
        )}

        <RelatedArticles
          relatedArticles={relatedArticles}
          onRelatedClick={handleRelatedClick}
        />
      </div>
    </article>
  );
};

export default SinglePost;
