import React from 'react';
import axios from 'axios';
import TemplatesList from '@/components/templates/TemplatesList';

async function getTemplates() {
  let templates;

  await axios
    .get('https://benew-client-next15.vercel.app/api/templates')
    .then((response) => {
      console.log('Response from API:', response.data);
      templates = response.data.templates || [];
    })
    .catch((err) => console.log(err));

  return templates;
}

const TemplatesPage = async () => {
  const templates = await getTemplates();

  return <TemplatesList templates={templates} />;
};

export default TemplatesPage;
