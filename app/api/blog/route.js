import { NextResponse } from 'next/server';
import { getClient } from '@/utils/dbConnect';

export const dynamic = 'force-dynamic';

export async function GET() {
  let client;
  try {
    const query = {
      // give the query a unique name
      name: 'get-article',
      text: "SELECT article_id, article_title, article_image, TO_CHAR(article_created,'dd/MM/yyyy') as created FROM admin.articles ORDER BY created DESC, article_id DESC AND is_active = true",
    };

    client = await getClient();

    const getResult = await client.query(query);

    if (getResult) {
      if (client) await client.cleanup();
    }

    return NextResponse.json(
      {
        success: true,
        data: getResult,
      },
      { status: 200 },
    );
  } catch (e) {
    if (client) await client.cleanup();
    return NextResponse.json(
      {
        success: false,
        message: 'Something goes wrong !Please try again',
      },
      { status: 500 },
    );
  }
}
