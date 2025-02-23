import React from 'react';
import TemplatesList from '@/components/templates/TemplatesList';

async function getTemplates() {
  let templates;

  await axios
    .get('https://benew-client-next15.vercel.app/api/templates')
    .then((response) => {
      templates = response.data.data.rows;
    })
    .catch((err) => console.log(err));

  return templates;
}

const TemplatesPage = async () => {
  const templates = await getTemplates();

  return <TemplatesList templates={templates} />;
};

export default TemplatesPage;
