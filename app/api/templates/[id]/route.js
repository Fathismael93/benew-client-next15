// app/api/dashboard/templates/[id]/route.js
import { NextResponse } from 'next/server';
import { getClient } from '@/utils/dbConnect';

export async function GET(request, { params }) {
  console.log(
    'WE ARE IN THE GET APPLICATIONS OF A SINGLE TEMPLATE REQUEST API',
  );
  const { id } = await params;
  const client = await getClient();

  try {
    const result = await client.query(
      'SELECT * FROM applications WHERE application_template_id = $1',
      [id],
    );

    if (!result) {
      console.log('error not found');
      if (client) await client.cleanup();
      return NextResponse.json(
        { message: 'Template not found' },
        { status: 404 },
      );
    }

    if (client) await client.cleanup();

    console.log('Applications: ');
    console.log(result);

    return NextResponse.json({ applications: result }, { status: 200 });
  } catch (error) {
    if (client) await client.cleanup();
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { message: 'Failed to fetch template', error: error.message },
      { status: 500 },
    );
  } finally {
    await client.cleanup();
  }
}
