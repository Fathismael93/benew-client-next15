import SinglePost from '@/components/blog/SinglePost';
import { articleIdSchema } from '@utils/schemas/schema';
import { getClient } from 'backend/dbConnect';

async function getSinglePost(id) {
  let client;
  let article = null;

  try {
    // Valider l'ID avec le schéma
    await articleIdSchema.validate({ id });

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

    if (client) await client.release();

    return article;
  } catch (error) {
    console.error('Error fetching single post:', error);
    if (client) await client.release();
    return null;
  }
}

async function SinglePostPage({ params }) {
  const { id } = await params;
  const article = await getSinglePost(id);

  return <SinglePost article={article} />;
}

export default SinglePostPage;
