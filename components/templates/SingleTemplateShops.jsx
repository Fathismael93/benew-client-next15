'use client';

import { useState } from 'react';
import { CldImage } from 'next-cloudinary';
import Link from 'next/link';
import { FaDollarSign } from 'react-icons/fa';
import { IoEye } from 'react-icons/io5';
import './styling/templateShops.scss';
import Parallax from '@/components/layouts/parallax';
import OrderModal from '../modal/OrderModal';
import { formatPrice, getApplicationLevelLabel } from '@utils/helpers';

const SingleTemplateShops = ({ templateID, applications, platforms }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);

  // Remplacer la fonction handleOrderClick
  const handleOrderClick = (app) => {
    // Vérifier si platforms existe et n'est pas vide
    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      alert('Aucune méthode de paiement disponible pour le moment');
      return;
    }
    setSelectedApp(app);
    setIsModalOpen(true);
  };

  return (
    <div>
      <section className="first">
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

      {applications.length !== undefined &&
        applications.map((app) => (
          <section key={app.application_id} className="others projectSection">
            <div className="application-card">
              <div className="card-image">
                <CldImage
                  src={app.application_images[0]}
                  alt={app.application_name}
                  width={400}
                  height={200}
                  className="app-image"
                  priority
                />
              </div>

              <div className="card-content">
                <h3 className="app-title">
                  {app.application_name} | {app.application_category}
                </h3>
                <p className="app-subtitle">
                  Type:{' '}
                  <span className="level">
                    {getApplicationLevelLabel(app.application_level)}
                  </span>
                </p>

                <div className="card-footer">
                  <div className="price-section">
                    <span className="price">
                      {formatPrice(app.application_fee)} FDJ
                    </span>
                    <div className="rent">
                      <span className="rent-price">
                        {formatPrice(app.application_rent)} FDJ/mois
                      </span>
                    </div>
                  </div>

                  <div className="action-buttons">
                    <button
                      className="btn btn-cart"
                      onClick={() => handleOrderClick(app)}
                      disabled={!platforms || platforms.length === 0}
                    >
                      <FaDollarSign size={16} />
                    </button>
                    <Link
                      href={`/templates/${templateID}/applications/${app.application_id}`}
                      className="btn btn-preview"
                    >
                      <IoEye size={16} />
                      Voir +
                    </Link>
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
