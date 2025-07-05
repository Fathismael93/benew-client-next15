// app/templates/[id]/applications/[appID]/page.jsx
import SingleApplication from '@/components/templates/SingleApplication';
import { getClient } from 'backend/dbConnect';

const getApplication = async (id) => {
  const client = await getClient();

  try {
    // Récupérer l'application spécifique
    const resultApp = await client.query(
      'SELECT * FROM catalog.applications WHERE application_id = $1 AND is_active = true',
      [id],
    );

    // Récupérer les plateformes actives
    const resultPlatforms = await client.query(
      'SELECT * FROM admin.platforms WHERE is_active = true',
    );

    return {
      application: resultApp.rows || [],
      platforms: resultPlatforms.rows || [],
    };
  } catch (error) {
    console.error('Error fetching application data:', error);
    return {
      application: [],
      platforms: [],
    };
  } finally {
    await client.release();
  }
};

const SingleAppPage = async ({ params }) => {
  const { appID } = await params;
  const { application, platforms } = await getApplication(appID);

  return <SingleApplication application={application} platforms={platforms} />;
};

export default SingleAppPage;
