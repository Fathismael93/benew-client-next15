'use client';

import React, { useState } from 'react';
import { CldImage } from 'next-cloudinary';
import parse from 'html-react-parser';
import './styling/singlePost.scss';

const SinglePost = ({ article }) => {
  // eslint-disable-next-line no-unused-vars
  const [errorMessage, setErrorMessage] = useState('');

  console.log('Article: ');
  console.log(article);

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
