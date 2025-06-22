import React from 'react';
import axios from 'axios';
import SingleApplication from '@/components/templates/SingleApplication';

const getApplication = async (id) => {
  let application, platforms;

  try {
    const response = await axios.get(
      `https://benew-client-next15.vercel.app/api/applications/${id}`,
    );

    application = response.data.application || {};
    platforms = response.data.platforms || [];
  } catch (error) {}

  return { application, platforms };
};

const SingleAppPage = async ({ params }) => {
  const { appID } = await params;

  const { application, platforms } = await getApplication(appID);

  return <SingleApplication application={application} platforms={platforms} />;
};

export default SingleAppPage;
