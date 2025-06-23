// app/templates/[id]/page.jsx
import React from 'react';
import { getClient } from '@/utils/dbConnect';
import SingleTemplateShops from '@/components/templates/SingleTemplateShops';

const getApplications = async (id) => {
  const client = await getClient();

  try {
    // Récupérer les applications liées au template
    const resultApps = await client.query(
      `SELECT 
        catalog.applications.application_id, 
        application_name, 
        application_link, 
        application_fee, 
        application_images, 
        application_level,
        catalog.templates.template_name 
      FROM catalog.applications
      JOIN catalog.templates ON catalog.applications.application_template_id = catalog.templates.template_id 
      WHERE catalog.applications.application_template_id = $1 
        AND catalog.applications.is_active = true 
        AND catalog.templates.is_active = true`,
      [id],
    );

    // Récupérer les plateformes actives
    const resultPlatforms = await client.query(
      'SELECT * FROM admin.platforms WHERE is_active = true',
    );

    return {
      applications: resultApps.rows || [],
      platforms: resultPlatforms.rows || [],
    };
  } catch (error) {
    console.error('Error fetching template data:', error);
    return {
      applications: [],
      platforms: [],
    };
  } finally {
    await client.cleanup();
  }
};

const ShopsPage = async ({ params }) => {
  const { id } = await params;
  const { applications, platforms } = await getApplications(id);

  return (
    <SingleTemplateShops
      templateID={id}
      applications={applications}
      platforms={platforms}
    />
  );
};

export default ShopsPage;
