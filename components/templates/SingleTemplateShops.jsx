'use client';

import React from 'react';
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
          title={
            applications !== undefined
              ? applications[0]?.template_name
              : 'Modèle vide'
          }
          planets="/sun.png"
        />
      </section>
      {applications.map((app) => (
        <section key={app.application_id} className="others projectSection">
          <div className="contentWrapper">
            <div className="imageContainer">
              <CldImage
                src={app.application_images[0]}
                alt={app.application_name}
                width={800}
                height={1000}
                className="projectImage"
                priority
              />
            </div>
            <div className="detailsContainer">
              <Link
                href={`/templates/${app.application_link}`}
                className="titleLink"
              >
                <h4 className="projectTitle">{app.application_name}</h4>
              </Link>
              <div className="appDetails">
                <p className="appFee">Prix: {app.application_fee}</p>
                <a
                  href={app.application_url}
                  className="appLink"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visiter l'application
                </a>
                <button className="appButton">En savoir plus</button>
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
};

export default SingleTemplateShops;
