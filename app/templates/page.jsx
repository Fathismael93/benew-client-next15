import React from 'react';
import TemplatesList from '@/components/templates/TemplatesList';
import { getClient } from '@/utils/dbConnect';

async function getTemplates() {
  const client = await getClient();
  try {
    const result = await client.query(
      'SELECT template_id, template_name, template_image, template_has_web, template_has_mobile FROM catalog.templates WHERE is_active=true ORDER BY template_added DESC',
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching templates:', error);
    return [];
  } finally {
    await client.cleanup();
  }
}

const TemplatesPage = async () => {
  const templates = await getTemplates();

  return <TemplatesList templates={templates} />;
};

export default TemplatesPage;
