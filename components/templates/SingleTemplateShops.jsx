'use client';

import React, { useState } from 'react';
import { CldImage } from 'next-cloudinary';
import './styling/templateShops.scss';
import Parallax from '@/components/layouts/parallax';
import OrderModal from '../modal';

const SingleTemplateShops = ({ applications }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

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
              <h4 className="projectTitle">{app.application_name}</h4>
              <div className="appDetails">
                <p className="appFee">Prix: {app.app_fee}</p>
                <a
                  href={app.application_url}
                  className="appLink"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visiter l'application
                </a>
                <div className="buttonGroup">
                  <a
                    href={`/templates/${app.application_link}`}
                    className="primaryButton"
                  >
                    En savoir plus
                  </a>
                  <button
                    className="secondaryButton"
                    onClick={() => setIsModalOpen(true)}
                  >
                    Commander maintenant
                  </button>
                </div>
              </div>
            </div>
          </div>
          <OrderModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
          />
        </section>
      ))}
    </div>
  );
};

export default SingleTemplateShops;
