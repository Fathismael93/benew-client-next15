import React from 'react';
import axios from 'axios';
import ListBlog from '@/components/blog/ListBlog';

async function getPosts() {
  let posts;

  await axios
    .get('https://benew-client-next15.vercel.app/api/blog')
    .then((response) => {
      posts = response.data.data.rows;
    })
    .catch((err) => console.log(err));

  return posts;
}

async function BlogPage() {
  const posts = await getPosts();

  return <ListBlog posts={posts} />;
}

export default BlogPage;
