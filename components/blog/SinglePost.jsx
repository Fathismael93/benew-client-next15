/* eslint-disable no-unused-vars */
'use client';

import { useState, useEffect, useRef } from 'react';
import { CldImage } from 'next-cloudinary';
import parse from 'html-react-parser';
import './styling/singlePost/index.scss';

// ⭐ AJOUT : Analytics imports
import {
  trackPagePerformance,
  trackEvent,
  trackBlogView,
} from '@/utils/analytics';
import PageTracker from '../analytics/PageTracker';

const SinglePost = ({
  article,
  relatedArticles,
  contextStats,
  adaptiveConfig,
  performanceMetrics,
  context,
}) => {
  const [errorMessage, setErrorMessage] = useState('');

  // ⭐ AJOUT : États pour tracking de lecture
  const [readingProgress, setReadingProgress] = useState(0);
  const [readingStartTime] = useState(Date.now());
  const [readingMilestones, setReadingMilestones] = useState({
    25: false,
    50: false,
    75: false,
    100: false,
  });
  const [hasStartedReading, setHasStartedReading] = useState(false);
  const [timeSpentReading, setTimeSpentReading] = useState(0);

  // ⭐ AJOUT : Refs pour tracking
  const articleContentRef = useRef(null);
  const readingTimerRef = useRef(null);

  // ⭐ AJOUT : Tracking des performances de page
  useEffect(() => {
    if (performanceMetrics?.loadTime && context?.articleId) {
      trackPagePerformance(
        `article_${context.articleId}`,
        performanceMetrics.loadTime,
        performanceMetrics.fromCache,
      );
    }
  }, [performanceMetrics, context]);

  // ⭐ AJOUT : Tracking de la vue initiale de l'article
  useEffect(() => {
    if (context?.articleId && article?.article_title) {
      // Utiliser la fonction spécialisée blog
      trackBlogView(context.articleId, article.article_title);

      // Tracking enrichi supplémentaire
      trackEvent('blog_article_view', {
        event_category: 'blog',
        event_label: article.article_title,
        article_id: context.articleId,
        article_title: article.article_title,
        word_count: context.stats?.article?.wordCount || 0,
        estimated_reading_time:
          context.stats?.article?.estimatedReadingTime || 0,
        has_images: context.stats?.article?.hasImages || false,
        is_recent: context.stats?.article?.isRecent || false,
        age_in_days: context.stats?.article?.ageInDays || 0,
        has_cloudinary_image:
          context.stats?.article?.hasCloudinaryImage || false,
        total_blog_articles: context.stats?.blog?.totalActiveArticles || 0,
        load_time: performanceMetrics?.loadTime || 0,
        from_cache: performanceMetrics?.fromCache || false,
      });
    }
  }, [context, article, performanceMetrics]);

  // ⭐ AJOUT : Tracking du progrès de lecture
  useEffect(() => {
    if (!articleContentRef.current) return;

    const handleScroll = () => {
      const contentElement = articleContentRef.current;
      if (!contentElement) return;

      const contentTop = contentElement.offsetTop;
      const contentHeight = contentElement.offsetHeight;
      const windowHeight = window.innerHeight;
      const scrollTop = window.scrollY;

      // Calculer le progrès de lecture
      const contentBottom = contentTop + contentHeight;
      const readableTop = contentTop - windowHeight * 0.3; // Début de lecture
      const readableBottom = contentBottom - windowHeight * 0.7; // Fin de lecture

      if (scrollTop >= readableTop && scrollTop <= readableBottom) {
        if (!hasStartedReading) {
          setHasStartedReading(true);

          // Démarrer le timer de temps de lecture
          readingTimerRef.current = setInterval(() => {
            setTimeSpentReading((prev) => prev + 1);
          }, 1000);

          trackEvent('article_reading_start', {
            event_category: 'engagement',
            event_label: 'reading_started',
            article_id: context?.articleId,
            article_title: article?.article_title,
            estimated_reading_time:
              context?.stats?.article?.estimatedReadingTime || 0,
          });
        }

        // Calculer le pourcentage de lecture
        const progress = Math.min(
          100,
          Math.max(
            0,
            ((scrollTop - readableTop) / (readableBottom - readableTop)) * 100,
          ),
        );

        setReadingProgress(progress);

        // Tracker les milestones de lecture
        Object.keys(readingMilestones).forEach((milestone) => {
          const milestoneValue = parseInt(milestone);
          if (progress >= milestoneValue && !readingMilestones[milestone]) {
            setReadingMilestones((prev) => ({
              ...prev,
              [milestone]: true,
            }));

            trackEvent('article_reading_milestone', {
              event_category: 'engagement',
              event_label: `${milestone}_percent_read`,
              reading_progress: milestoneValue,
              time_spent: timeSpentReading,
              article_id: context?.articleId,
              estimated_vs_actual:
                timeSpentReading /
                ((context?.stats?.article?.estimatedReadingTime || 1) * 60),
              word_count: context?.stats?.article?.wordCount || 0,
            });
          }
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (readingTimerRef.current) {
        clearInterval(readingTimerRef.current);
      }
    };
  }, [
    hasStartedReading,
    readingMilestones,
    timeSpentReading,
    context,
    article,
  ]);

  // ⭐ AJOUT : Tracking de sortie avec temps de lecture final
  useEffect(() => {
    return () => {
      if (hasStartedReading && context?.articleId) {
        const actualReadingTimeMinutes = timeSpentReading / 60;
        const estimatedTimeMinutes =
          context?.stats?.article?.estimatedReadingTime || 0;
        const completionRate = readingProgress;

        trackEvent('article_reading_end', {
          event_category: 'engagement',
          event_label: 'reading_ended',
          article_id: context.articleId,
          actual_reading_time: timeSpentReading,
          estimated_reading_time: estimatedTimeMinutes * 60,
          reading_efficiency:
            estimatedTimeMinutes > 0
              ? actualReadingTimeMinutes / estimatedTimeMinutes
              : 0,
          completion_rate: completionRate,
          reading_type:
            completionRate >= 90
              ? 'complete'
              : completionRate >= 50
                ? 'partial'
                : 'quick_scan',
          word_count: context?.stats?.article?.wordCount || 0,
        });
      }
    };
  }, [hasStartedReading, timeSpentReading, readingProgress, context]);

  // ⭐ AJOUT : Tracking des clics sur images
  const handleImageClick = (imageSrc) => {
    trackEvent('article_image_click', {
      event_category: 'content_interaction',
      event_label: 'image_clicked',
      article_id: context?.articleId,
      image_src: imageSrc,
      reading_progress: readingProgress,
      time_spent: timeSpentReading,
    });
  };

  // ⭐ AJOUT : Tracking des erreurs de contenu
  useEffect(() => {
    if (!article || !article.article_title || !article.article_text) {
      trackEvent('article_content_error', {
        event_category: 'errors',
        event_label: 'missing_content',
        article_id: context?.articleId,
        has_title: !!article?.article_title,
        has_content: !!article?.article_text,
        has_image: !!article?.article_image,
        error_message: errorMessage,
      });
    }
  }, [article, context, errorMessage]);

  // ⭐ AJOUT : Tracking de performance lente
  useEffect(() => {
    if (performanceMetrics && performanceMetrics.loadTime > 2000) {
      trackEvent('article_slow_loading', {
        event_category: 'performance',
        event_label: 'slow_article_load',
        load_time: performanceMetrics.loadTime,
        from_cache: performanceMetrics.fromCache,
        word_count: context?.stats?.article?.wordCount || 0,
        has_images: context?.stats?.article?.hasImages || false,
        severity: performanceMetrics.loadTime > 4000 ? 'critical' : 'warning',
      });
    }
  }, [performanceMetrics, context]);

  // ⭐ AJOUT : Enrichir le parsing HTML pour tracker les clics d'images
  const enrichedParseOptions = {
    replace: (domNode) => {
      if (domNode.name === 'img' && domNode.attribs?.src) {
        const originalSrc = domNode.attribs.src;
        return (
          <img
            {...domNode.attribs}
            onClick={() => handleImageClick(originalSrc)}
            style={{ cursor: 'pointer' }}
            alt={domNode.attribs.alt || "Image de l'article"}
          />
        );
      }
    },
  };

  return (
    <article>
      {/* ⭐ AJOUT : PageTracker pour tracking standardisé */}
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
        <h1>{article && article.article_title}</h1>
        {article && (
          <CldImage
            priority
            src={article.article_image}
            alt="Article illustration"
            width={640}
            height={100}
            className="imageContainer"
            style={{ width: '100%', height: 'auto', maxHeight: '400px' }}
            onClick={() => handleImageClick(article.article_image)}
          />
        )}

        {/* ⭐ AJOUT : Indicateur de progrès de lecture (optionnel, caché par défaut) */}
        {hasStartedReading && (
          <div
            className="reading-progress-indicator"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              height: '3px',
              backgroundColor: '#f6a037',
              width: `${readingProgress}%`,
              zIndex: 1000,
              transition: 'width 0.1s ease',
              display: 'none', // Caché par défaut, peut être affiché via CSS si désiré
            }}
          />
        )}

        <div className="part" ref={articleContentRef}>
          {article && parse(article.article_text, enrichedParseOptions)}
        </div>
        {article && <em>{`Publié le ${article.created}`}</em>}

        {/* ⭐ AJOUT : Métadonnées de lecture (cachées, pour debug si nécessaire) */}
        {process.env.NODE_ENV === 'development' && hasStartedReading && (
          <div
            style={{
              position: 'fixed',
              bottom: '10px',
              right: '10px',
              background: 'rgba(0,0,0,0.8)',
              color: 'white',
              padding: '10px',
              fontSize: '12px',
              borderRadius: '5px',
              zIndex: 1000,
              display: 'none', // Visible seulement en mode debug
            }}
          >
            <div>Progrès: {Math.round(readingProgress)}%</div>
            <div>Temps: {Math.round(timeSpentReading)}s</div>
            <div>
              Estimé: {context?.stats?.article?.estimatedReadingTime || 0}min
            </div>
          </div>
        )}
      </div>
    </article>
  );
};

export default SinglePost;
