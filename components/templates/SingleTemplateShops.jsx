'use client';
import React, { useState } from 'react';
import { CldImage } from 'next-cloudinary';
import './styling/templateShops.scss';
import Parallax from '@/components/layouts/parallax';
import OrderModal from '../modal';

const SingleTemplateShops = ({ templateID, applications, platforms }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);

  const handleOrderClick = (app) => {
    setSelectedApp(app);
    setIsModalOpen(true);
  };

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
              <p className="appType">Type: {app.application_type}</p>
              <div className="appDetails">
                <p className="appFee">Prix: {app.application_fee} Fdj</p>
                <a
                  href={app.application_link}
                  className="appLink"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visiter l'application
                </a>
                <div className="buttonGroup">
                  <button
                    className="primaryButton"
                    onClick={() => handleOrderClick(app)}
                  >
                    Commander maintenant
                  </button>
                  <a
                    href={`/templates/${templateID}/applications/${app.application_id}`}
                    className="secondaryButton"
                  >
                    En savoir plus
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      {selectedApp && (
        <OrderModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedApp(null);
          }}
          platforms={platforms}
          applicationId={selectedApp.application_id}
          applicationFee={selectedApp.application_fee}
        />
      )}
    </div>
  );
};

export default SingleTemplateShops;
