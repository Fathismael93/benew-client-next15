import React from 'react';
import axios from 'axios';
import articleIDSchema from '@/utils/schema';
import SinglePost from '@/components/blog/SinglePost';

async function getSinglePost(id) {
  let article = {};
  // try {
  //   await articleIDSchema.validate({ id });

  //   await axios
  //     .get(`https://benew-client-next15.vercel.app/api/blog/${id}`)
  //     .then((response) => {
  //       console.log('Response from API:', response.data);
  //       article = response.data.data || {};
  //     })
  //     .catch((err) => {
  //       console.log(err);
  //     });
  // } catch (error) {
  //   console.log(error);
  // }

  return article;
}

async function SinglePostPage({ params }) {
  const { id } = await params;
  const article = await getSinglePost(id);

  return <SinglePost article={article} />;
}

export default SinglePostPage;
