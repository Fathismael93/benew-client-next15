'use client';

import { useState } from 'react';
import { CldImage } from 'next-cloudinary';
import Link from 'next/link';
import { FaDollarSign } from 'react-icons/fa';
import { IoEye } from 'react-icons/io5';
import './styling/templateShops.scss';
import Parallax from '@/components/layouts/parallax';
import OrderModal from '../modal/OrderModal';

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

  // Méthode pour convertir le niveau d'application en libellé
  const getApplicationLevelLabel = (level) => {
    switch (level) {
      case 1:
        return 'Boutique Simplifiée';
      case 2:
        return 'Boutique Standard';
      case 3:
        return 'Boutique Supérieure';
      case 4:
        return 'Boutique Sophistiquée';
      default:
        return `Niveau ${level}`;
    }
  };

  // Méthode pour formater les prix avec K si nécessaire
  const formatPrice = (price) => {
    // Convertir en nombre si c'est une string
    const numPrice = typeof price === 'string' ? parseInt(price) : price;

    // Vérifier si le nombre est divisible par 1000
    if (numPrice >= 1000 && numPrice % 1000 === 0) {
      return `${numPrice / 1000}K`;
    }
    // Vérifier si le nombre est supérieur à 1000 mais pas exactement divisible
    else if (numPrice >= 1000) {
      const kValue = numPrice / 1000;
      // Si c'est un nombre décimal, garder une décimale
      return kValue % 1 === 0 ? `${kValue}K` : `${kValue.toFixed(1)}K`;
    }
    // Retourner le nombre original si moins de 1000
    else {
      return numPrice.toString();
    }
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
                {/* <div className="image-overlay">
                  <div className="stats-badge">
                    <span className="level-badge">
                      Niveau {app.application_level}
                    </span>
                  </div>
                </div> */}
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
