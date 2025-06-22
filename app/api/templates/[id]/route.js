// app/api/dashboard/templates/[id]/route.js
import { NextResponse } from 'next/server';
import { getClient } from '@/utils/dbConnect';

export async function GET(request, { params }) {
  const { id } = await params;
  const client = await getClient();

  try {
    const resultApps = await client.query(
      'SELECT ' +
        'catalog.applications.application_id, application_name, application_link, application_fee, application_images, application_level, ' +
        'catalog.templates.template_name FROM catalog.applications' +
        'JOIN catalog.templates ON catalog.applications.application_template_id = catalog.templates.template_id ' +
        'WHERE catalog.applications.application_template_id = $1 AND catalog.applications.is_active = true AND catalog.templates.is_active = true',
      [id],
    );

    if (!resultApps) {
      if (client) await client.cleanup();
      return NextResponse.json(
        { message: 'Template not found' },
        { status: 404 },
      );
    }

    const resultPlatforms = await client.query(
      'SELECT * FROM admin.platforms WHERE is_active = true',
    );

    if (!resultPlatforms) {
      if (client) await client.cleanup();
      return NextResponse.json(
        { message: 'Platforms not found' },
        { status: 404 },
      );
    }

    if (client) await client.cleanup();

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
