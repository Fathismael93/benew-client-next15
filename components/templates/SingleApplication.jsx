'use client';

import React from 'react';
import Parallax from '../layouts/parallax';
import './styling/application.scss';

const SingleApplication = ({ application, platforms }) => {
  console.log('Single application data: ');
  console.log(application);

  console.log('platforms data: ');
  console.log(platforms);

  return (
    <div>
      <section className="others">
        <Parallax
          bgColor="#0c0c1d"
          title={
            application !== undefined ? application[0]?.application_name : ''
          }
          planets="/sun.png"
        />
      </section>
      <section className="others"></section>
    </div>
  );
};

export default SingleApplication;
