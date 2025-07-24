'use client';

import { useEffect, useState } from 'react';
import { CldImage } from 'next-cloudinary';
import Link from 'next/link';
import { FaDollarSign } from 'react-icons/fa';
import { IoEye } from 'react-icons/io5';
import './styling/templateShops.scss';
import Parallax from '@/components/layouts/parallax';
import OrderModal from '../modal/OrderModal';
import { formatPrice, getApplicationLevelLabel } from '@utils/helpers';
// Ajouter ces imports
import {
  trackApplicationView,
  trackOrderStart,
  trackPagePerformance,
} from '@/utils/analytics';

const SingleTemplateShops = ({
  templateID,
  applications,
  platforms,
  performanceMetrics,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);

  // Tracker les performances de la page template
  useEffect(() => {
    if (performanceMetrics?.loadTime) {
      trackPagePerformance(
        `template_${templateID}`,
        performanceMetrics.loadTime,
        performanceMetrics.fromCache,
      );
    }
  }, [performanceMetrics, templateID]);

  // Remplacer la fonction handleOrderClick
  const handleOrderClick = (app) => {
    // Vérifier si platforms existe et n'est pas vide
    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      alert('Aucune méthode de paiement disponible pour le moment');
      return;
    }

    // Tracker le début de la commande
    trackOrderStart(app);

    setSelectedApp(app);
    setIsModalOpen(true);
  };

  // Ajouter une fonction pour tracker les vues d'applications
  const handleApplicationView = (app) => {
    trackApplicationView(app.application_id, app.application_name, templateID);
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
                <h3 className="app-title">{app.application_name}</h3>

                <p className="app-meta">
                  <span className="level">
                    {getApplicationLevelLabel(app.application_level).long}
                  </span>
                  <span className="separator">-</span>
                  <span className="category">{app.application_category}</span>
                </p>

                <div className="price-section">
                  <div className="price-item">
                    <span className="price-label">
                      Frais d&apos;acquisition
                    </span>
                    <span className="price">
                      {formatPrice(app.application_fee)} FDJ
                    </span>
                  </div>
                  <div className="price-item">
                    <span className="price-label">Frais de gestion</span>
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
                    // Ajouter le tracking de la vue d'application
                    onClick={() => handleApplicationView(app)}
                  >
                    <IoEye size={16} />
                    <span className="btn-text">Voir +</span>
                  </Link>
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
