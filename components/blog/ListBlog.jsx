/* eslint-disable no-unused-vars */
'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import ArticleItem from '@/components/blog/articleItem';
import Parallax from '@/components/layouts/parallax';
import './styling/blog.scss';

// ⭐ AJOUT : Analytics imports
import { trackPagePerformance, trackEvent } from '@/utils/analytics';
import PageTracker from '../analytics/PageTracker';

const ListBlog = ({
  posts,
  adaptiveConfig,
  performanceMetrics,
  blogMetrics,
}) => {
  const ref = useRef();
  const [errorMessage, setErrorMessage] = useState(
    'Aucun contenu pour le moment, désolé !',
  );

  // ⭐ AJOUT : État pour tracking du scroll
  const [scrollMilestones, setScrollMilestones] = useState({
    25: false,
    50: false,
    75: false,
    90: false,
  });

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['end end', 'start start'],
  });

  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
  });

  // ⭐ AJOUT : Tracking des performances de page
  useEffect(() => {
    if (performanceMetrics?.loadTime) {
      trackPagePerformance(
        'blog_list',
        performanceMetrics.loadTime,
        performanceMetrics.fromCache,
      );
    }
  }, [performanceMetrics]);

  // ⭐ AJOUT : Tracking de la vue initiale du blog
  useEffect(() => {
    if (posts && posts.length >= 0) {
      trackEvent('blog_list_view', {
        event_category: 'blog',
        event_label: 'blog_list_page',
        articles_count: posts.length,
        has_articles: posts.length > 0,
        recent_articles: blogMetrics?.recentArticles || 0,
        total_articles: blogMetrics?.totalArticles || posts.length,
        cloudinary_images: blogMetrics?.hasCloudinaryImages || 0,
        load_time: performanceMetrics?.loadTime || 0,
        from_cache: performanceMetrics?.fromCache || false,
      });
    }
  }, [posts, blogMetrics, performanceMetrics]);

  // ⭐ AJOUT : Tracking du scroll progress avec milestones
  useEffect(() => {
    const unsubscribe = scrollYProgress.onChange((value) => {
      const percent = Math.round(value * 100);

      // Tracker les milestones de scroll
      Object.keys(scrollMilestones).forEach((milestone) => {
        const milestoneValue = parseInt(milestone);
        if (percent >= milestoneValue && !scrollMilestones[milestone]) {
          setScrollMilestones((prev) => ({
            ...prev,
            [milestone]: true,
          }));

          trackEvent('blog_scroll_milestone', {
            event_category: 'engagement',
            event_label: `${milestone}_percent`,
            scroll_depth: milestoneValue,
            articles_count: posts?.length || 0,
            progress_bar_value: value,
            page_type: 'blog_list',
          });
        }
      });

      // Tracker l'interaction avec la progress bar (uniquement si significative)
      if (percent > 10 && percent % 20 === 0) {
        trackEvent('blog_progress_interaction', {
          event_category: 'ui_interaction',
          event_label: 'progress_bar',
          progress_value: value,
          scroll_percent: percent,
          articles_visible: posts?.length || 0,
          non_interaction: true, // N'affecte pas le bounce rate
        });
      }
    });

    return unsubscribe;
  }, [scrollYProgress, scrollMilestones, posts?.length]);

  // ⭐ AJOUT : Tracking de l'état vide du blog
  useEffect(() => {
    if (posts && posts.length === 0) {
      trackEvent('blog_empty_state', {
        event_category: 'blog',
        event_label: 'no_articles_available',
        error_message: errorMessage,
        page_type: 'blog_list',
        load_time: performanceMetrics?.loadTime || 0,
      });
    }
  }, [posts, errorMessage, performanceMetrics]);

  // ⭐ AJOUT : Tracking des erreurs de chargement
  useEffect(() => {
    if (performanceMetrics && performanceMetrics.loadTime > 3000) {
      trackEvent('blog_slow_loading', {
        event_category: 'performance',
        event_label: 'slow_blog_load',
        load_time: performanceMetrics.loadTime,
        from_cache: performanceMetrics.fromCache,
        articles_count: posts?.length || 0,
        severity: performanceMetrics.loadTime > 5000 ? 'critical' : 'warning',
      });
    }
  }, [performanceMetrics, posts?.length]);

  return (
    <div>
      {/* ⭐ AJOUT : PageTracker pour tracking standardisé */}
      <PageTracker
        pageName="blog_list"
        pageType="blog"
        sections={[
          'hero_parallax',
          'articles_grid',
          'progress_indicator',
          'empty_state',
        ]}
      />

      <section className="first">
        <Parallax bgColor="#0c0c1d" title="Notre Blog" planets="/planets.png" />
      </section>
      <div className="portfolio" ref={ref}>
        <div className="progress">
          <h1>Les Articles</h1>
          <motion.div style={{ scaleX }} className="progressBar" />
        </div>
        {posts.length !== undefined && posts.length > 0 ? (
          posts.map((item) => (
            <ArticleItem
              article_id={item.article_id}
              article_title={item.article_title}
              article_image={item.article_image}
              created={item.created}
              key={item.article_id}
            />
          ))
        ) : (
          <section className="others">
            <div className="no-content">
              <p className="no-content-text">{errorMessage}</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ListBlog;
