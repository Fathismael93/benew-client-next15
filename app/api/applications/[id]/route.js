import { NextResponse } from 'next/server';
import { getClient } from '@/utils/dbConnect';

export async function GET(request, { params }) {
  const { id } = await params;
  const client = await getClient();

  try {
    const resultApp = await client.query(
      'SELECT * FROM catalog.applications WHERE application_id = $1 AND is_active = true',
      [id],
    );

    if (!resultApp) {
      if (client) await client.cleanup();
      return NextResponse.json(
        { message: 'Application not found' },
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
        application: resultApp.rows,
        platforms: resultPlatforms.rows,
      },
      { status: 200 },
    );
  } catch (error) {
    if (client) await client.cleanup();
    console.error('Error fetching single application:', error);
    return NextResponse.json(
      { message: 'Failed to fetch single application', error: error.message },
      { status: 500 },
    );
  } finally {
    await client.cleanup();
  }
}
