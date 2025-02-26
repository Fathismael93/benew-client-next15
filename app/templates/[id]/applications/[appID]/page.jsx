import React from 'react';
import axios from 'axios';
import SingleApplication from '@/components/templates/SingleApplication';

const getApplication = async (id) => {
  let application, platforms;

  try {
    const response = await axios.get(
      `https://benew-client-next15.vercel.app/api/applications/${id}`,
    );

    console.log('Application response in server component');
    console.log(response.data.application);

    application = response.data.application;
    platforms = response.data.platforms;
  } catch (error) {}

  return { application, platforms };
};

const SingleAppPage = async ({ params }) => {
  console.log('Params in SINGLE APP PAGE');
  console.log(await params);

  const { id } = await params;

  const { application, platforms } = await getApplication(id);

  return <SingleApplication application={application} platforms={platforms} />;
};

export default SingleAppPage;
