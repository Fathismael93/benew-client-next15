'use client';

import React from 'react';
// pages/portfolio.js
import Link from 'next/link';
import { CldImage } from 'next-cloudinary';
import './styling/templateShops.scss';
import Parallax from '@/components/layouts/parallax';

const SingleTemplateShops = ({ applications }) => {
  return (
    <div>
      <section className="others">
        <Parallax
          bgColor="#0c0c1d"
          title={applications !== undefined && applications[0]?.template_name}
          planets="/sun.png"
        />
      </section>
      {applications.map((app) => (
        <section key={app.application_id} className="others projectSection">
          <div className="imageContainer">
            <CldImage
              src={app.application_images[0]}
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
