/* eslint-disable no-unused-vars */
'use client';

import { useState } from 'react';
import { CldImage } from 'next-cloudinary';
import parse from 'html-react-parser';
import './styling/singlePost.scss';

const SinglePost = ({
  article,
  relatedArticles,
  contextStats,
  adaptiveConfig,
  performanceMetrics,
  context,
}) => {
  console.log('Article:', article);
  console.log('Related Articles:', relatedArticles);
  console.log('Context Stats:', contextStats);
  console.log('Adaptive Config:', adaptiveConfig);
  console.log('Performance Metrics:', performanceMetrics);
  console.log('Context:', context);
  const [errorMessage, setErrorMessage] = useState('');

  return (
    <article>
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
          />
        )}
        <div className="part">{article && parse(article.article_text)}</div>
        {article && <em>{`Publié le ${article.created}`}</em>}
      </div>
    </article>
  );
};

export default SinglePost;
