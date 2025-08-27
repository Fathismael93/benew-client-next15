'use client';

import dynamic from 'next/dynamic';
import './styling/blog.scss';
import { useRef, useState, useEffect, useCallback, memo } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';

import ParallaxSkeleton from '../layouts/parallax/ParallaxSkeleton';
// Import dynamique des composants
const Parallax = dynamic(() => import('components/layouts/parallax'), {
  loading: () => <ParallaxSkeleton />,
  ssr: true,
});

import ArticleItemSkeleton from './skeletons/ArticleItemSkeleton';
// Import dynamique des composants
const ArticleItem = dynamic(() => import('./articleItem'), {
  loading: () => <ArticleItemSkeleton />,
  ssr: true,
});

import { trackEvent } from '@/utils/analytics';
import PageTracker from '../analytics/PageTracker';

// Composant de barre de progression mémorisé
const ProgressBar = memo(({ scaleX }) => (
  <div className="progress">
    <h1>Articles</h1>
    <motion.div style={{ scaleX }} className="progressBar" />
  </div>
));

ProgressBar.displayName = 'ProgressBar';

// Composant de grille d'articles mémorisé
const ArticlesGrid = memo(({ posts, onArticleView }) => (
  <>
    {posts.map((item) => (
      <ArticleItem
        key={item.article_id}
        article_id={item.article_id}
        article_title={item.article_title}
        article_image={item.article_image}
        created={item.created}
        onClick={() => onArticleView(item)}
      />
    ))}
  </>
));

ArticlesGrid.displayName = 'ArticlesGrid';

// Composant d'état vide mémorisé
const EmptyState = memo(({ errorMessage }) => (
  <section className="others">
    <div className="no-content">
      <p className="no-content-text">{errorMessage}</p>
    </div>
  </section>
));

EmptyState.displayName = 'EmptyState';

// Composant principal simplifié
const ListBlog = ({ posts = [], blogMetrics = {} }) => {
  const ref = useRef();
  const [errorMessage] = useState('Aucun contenu pour le moment, désolé !');
  const [viewedArticles, setViewedArticles] = useState(new Set());
  const [scrollTracked, setScrollTracked] = useState(false);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['end end', 'start start'],
  });

  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
  });

  // Tracking de la vue de la page (une seule fois)
  useEffect(() => {
    if (posts.length >= 0) {
      trackEvent('blog_list_view', {
        event_category: 'blog',
        event_label: 'blog_list_page',
        articles_count: posts.length,
        has_articles: posts.length > 0,
        recent_articles: blogMetrics?.recentArticles || 0,
        total_articles: blogMetrics?.totalArticles || posts.length,
      });
    }
  }, []); // Dépendance vide intentionnelle

  // Tracking simplifié du scroll (seulement à 50%)
  useEffect(() => {
    const unsubscribe = scrollYProgress.onChange((value) => {
      const percent = Math.round(value * 100);

      // Tracker seulement le milestone de 50% une fois
      if (percent >= 50 && !scrollTracked) {
        setScrollTracked(true);

        trackEvent('blog_scroll_engagement', {
          event_category: 'engagement',
          event_label: 'halfway_scroll',
          articles_count: posts.length,
        });
      }
    });

    return unsubscribe;
  }, [scrollYProgress, scrollTracked, posts.length]);

  // Tracking de l'état vide (une seule fois)
  useEffect(() => {
    if (posts.length === 0) {
      trackEvent('blog_empty_state', {
        event_category: 'blog',
        event_label: 'no_articles_available',
        error_message: errorMessage,
      });
    }
  }, []); // Dépendance vide intentionnelle

  // Handler pour le clic sur un article
  const handleArticleView = useCallback(
    (article) => {
      // Tracker seulement si pas déjà vu
      if (!viewedArticles.has(article.article_id)) {
        trackEvent('article_click', {
          event_category: 'blog',
          event_label: article.article_title,
          article_id: article.article_id,
        });

        setViewedArticles((prev) => new Set([...prev, article.article_id]));
      }
    },
    [viewedArticles],
  );

  return (
    <div>
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
        <Parallax bgColor="#0c0c1d" title="Blog" planets="/planets.png" />
      </section>

      <div className="portfolio" ref={ref}>
        <ProgressBar scaleX={scaleX} />

        {posts.length > 0 ? (
          <ArticlesGrid posts={posts} onArticleView={handleArticleView} />
        ) : (
          <EmptyState errorMessage={errorMessage} />
        )}
      </div>
    </div>
  );
};

export default ListBlog;
