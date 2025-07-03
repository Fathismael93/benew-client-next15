import React from 'react';
import { getClient } from '@/utils/dbConnect';
import articleIDSchema from '@/utils/schema';
import SinglePost from '@/components/blog/SinglePost';

async function getSinglePost(id) {
  let client;
  let article = null;

  try {
    // Valider l'ID avec le schéma
    await articleIDSchema.validate({ id });

    client = await getClient();

    const query = {
      // give the query a unique name
      name: 'get-single-article',
      text: "SELECT article_id, article_title, article_text, article_image, TO_CHAR(article_created,'dd/MM/yyyy') as created FROM admin.articles WHERE article_id=$1 AND is_active = true",
      values: [id],
    };

    const result = await client.query(query);

    if (result && result.rows.length > 0) {
      article = result.rows[0];
    }

    if (client) await client.cleanup();

    return article;
  } catch (error) {
    console.error('Error fetching single post:', error);
    if (client) await client.cleanup();
    return null;
  }
}

async function SinglePostPage({ params }) {
  const { id } = await params;
  const article = await getSinglePost(id);

  return <SinglePost article={article} />;
}

export default SinglePostPage;
