import React from 'react';
import axios from 'axios';
import SingleTemplateShops from '@/components/templates/SingleTemplateShops';

const getApplications = async (id) => {
  let applications;

  try {
    const response = await axios.get(
      `https://benew-client-next15.vercel.app/api/templates/${id}`,
    );

    console.log('Applications response in server component');
    console.log(response);
  } catch (error) {}

  return [];
};

const ShopsPage = async ({ params }) => {
  const { id } = await params;
  const applications = await getApplications(id);

  return <SingleTemplateShops applications={applications} />;
};

export default ShopsPage;
