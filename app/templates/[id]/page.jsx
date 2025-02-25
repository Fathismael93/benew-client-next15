import React from 'react';
import axios from 'axios';
import SingleTemplateShops from '@/components/templates/SingleTemplateShops';

const getApplications = async (id) => {
  let applications, platforms;

  try {
    const response = await axios.get(
      `https://benew-client-next15.vercel.app/api/templates/${id}`,
    );

    console.log('Applications response in server component');
    console.log(response.data.applications);

    applications = response.data.applications;
    platforms = response.data.platforms;
  } catch (error) {}

  return { applications, platforms };
};

const ShopsPage = async ({ params }) => {
  const { id } = await params;
  const { applications, platforms } = await getApplications(id);

  return (
    <SingleTemplateShops applications={applications} platforms={platforms} />
  );
};

export default ShopsPage;
