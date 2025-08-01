/* eslint-disable no-unused-vars */
'use client';

import { useRef, useState } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import ArticleItem from '@/components/blog/articleItem';
import Parallax from '@/components/layouts/parallax';
// import './styling/blog.scss';

const ListBlog = ({
  posts,
  adaptiveConfig,
  performanceMetrics,
  blogMetrics,
}) => {
  console.log('Posts:', posts);
  console.log('Adaptive Config:', adaptiveConfig);
  console.log('Performance Metrics:', performanceMetrics);
  console.log('Blog Metrics:', blogMetrics);
  const ref = useRef();
  const [errorMessage, setErrorMessage] = useState(
    'Aucun contenu pour le moment, désolé !',
  );

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['end end', 'start start'],
  });

  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
  });

  return (
    <div>
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
