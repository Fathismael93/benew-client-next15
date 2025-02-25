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
    const resultApps = await client.query(
      'SELECT ' +
        'applications.application_id, application_name, application_link, application_fee, application_images, application_type, ' +
        'templates.template_name FROM applications ' +
        'JOIN templates ON applications.application_template_id = templates.template_id ' +
        'WHERE applications.application_template_id = $1',
      [id],
    );

    if (!resultApps) {
      console.log('error not found');
      if (client) await client.cleanup();
      return NextResponse.json(
        { message: 'Template not found' },
        { status: 404 },
      );
    }

    const resultPlatforms = await client.query('SELECT * FROM platforms ');

    if (!resultPlatforms) {
      console.log('error not found');
      if (client) await client.cleanup();
      return NextResponse.json(
        { message: 'Platforms not found' },
        { status: 404 },
      );
    }

    if (client) await client.cleanup();

    console.log('Applications: ');
    console.log(resultApps);

    return NextResponse.json(
      {
        applications: resultApps.rows,
        platforms: resultPlatforms.rows,
      },
      { status: 200 },
    );
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
