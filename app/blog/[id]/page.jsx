'use client';

import React, { useEffect, useState } from 'react';
import { CldImage } from 'next-cloudinary';
import axios from 'axios';
import parse from 'html-react-parser';
import './singlePost.scss';
import articleIDSchema from '@/utils/schema';

function SinglePost({ params }) {
  const { id } = params;

  const [article, setArticle] = useState('');
  // eslint-disable-next-line no-unused-vars
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function getSinglePost() {
      try {
        await articleIDSchema.validate({ id });

        await axios
          .get(`/api/blog/${id}`)
          .then((response) => {
            setArticle(response.data.data);
          })
          .catch(() => {
            setErrorMessage('Article inexistant !');
          });
      } catch (error) {
        setErrorMessage('Article inexistant !');
      }
    }

    getSinglePost(id);
  }, [id]);

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
}

export default SinglePost;
