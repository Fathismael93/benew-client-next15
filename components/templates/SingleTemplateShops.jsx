'use client';

import React from 'react';
// pages/portfolio.js
import Link from 'next/link';
import './styling/templateShops.scss';
import Parallax from '@/components/layouts/parallax';
import Image from 'next/image';

const SingleTemplateShops = ({ applications }) => {
  const projects = [
    {
      id: 1,
      title: 'Transformation Digitale',
      image: '/e-commerce.jpg',
      link: '/templates/1',
    },
    {
      id: 2,
      title: 'Innovation Technologique',
      image: '/e-commerce2.jpg',
      link: '/templates/2',
    },
    {
      id: 3,
      title: 'Solutions Cloud',
      image: '/e-commerce3.jpg',
      link: '/templates/3',
    },
  ];

  console.log('Applications response in client component');
  console.log(applications);

  return (
    <div>
      <section className="others">
        <Parallax bgColor="#0c0c1d" title="Nos Modèles" planets="/sun.png" />
      </section>
      {applications.map((app) => (
        <section key={app.application_id} className="others projectSection">
          <div className="imageContainer">
            <Image
              src={app.application_image}
              alt={app.application_name}
              fill
              className="projectImage"
              priority
            />
          </div>
          <Link
            href={`/templates/${app.application_link}`}
            className="titleLink"
          >
            <h4 className="projectTitle">{app.application_name}</h4>
          </Link>
          {/* <div className="platforms">
              <MdMonitor />
              {project.template_has_mobile && <MdPhoneIphone />}
            </div> */}
        </section>
      ))}
    </div>
  );
};

export default SingleTemplateShops;
