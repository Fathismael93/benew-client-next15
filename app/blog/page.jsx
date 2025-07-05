import ListBlog from '@/components/blog/ListBlog';
import { getClient } from 'backend/dbConnect';

async function getPosts() {
  let client;
  let posts;

  try {
    const query = {
      // give the query a unique name
      name: 'get-article',
      text: "SELECT article_id, article_title, article_image, TO_CHAR(article_created,'dd/MM/yyyy') as created FROM admin.articles WHERE is_active = true ORDER BY created DESC, article_id DESC",
    };

    client = await getClient();

    const getResult = await client.query(query);

    if (getResult) {
      posts = getResult.rows || [];
      if (client) await client.release();
    }

    return posts;
  } catch (error) {
    console.error('Error fetching posts:', error);
    if (client) await client.release();
    return [];
  }
}

async function BlogPage() {
  const posts = await getPosts();

  return <ListBlog posts={posts} />;
}

export default BlogPage;
