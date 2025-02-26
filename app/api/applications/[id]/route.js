// app/api/dashboard/templates/[id]/route.js
import { NextResponse } from 'next/server';
import { getClient } from '@/utils/dbConnect';

export async function GET(request, { params }) {
  console.log('WE ARE IN THE GET SINGLE APPLICATION REQUEST API');

  console.log('params of the application : ');
  console.log(await params);
  const { id } = await params;
  const client = await getClient();

  try {
    const resultApp = await client.query(
      'SELECT * FROM applications WHERE application_id = $1',
      [id],
    );

    if (!resultApp) {
      console.log('error not found');
      if (client) await client.cleanup();
      return NextResponse.json(
        { message: 'Application not found' },
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

    console.log('Application: ');
    console.log(resultApp);

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
