// components/templates/SingleTemplateShops.jsx
'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, memo } from 'react';
import { CldImage } from 'next-cloudinary';
import Link from 'next/link';
import { FaDollarSign } from 'react-icons/fa';
import { IoEye } from 'react-icons/io5';
import './shopsStyles/index.scss';

import ParallaxSkeleton from '../layouts/parallax/ParallaxSkeleton';
// Import dynamique des composants
const Parallax = dynamic(() => import('components/layouts/parallax'), {
  loading: () => <ParallaxSkeleton />,
  ssr: true,
});

import OrderModal from '../modal/OrderModal';
import { formatPrice, getApplicationLevelLabel } from '@/utils/helpers';
import { trackEvent } from '@/utils/analytics';
import PageTracker from '../analytics/PageTracker';

// Composant de carte d'application mémorisé
const ApplicationCard = memo(
  ({ app, templateID, onOrderClick, onViewClick, hasPaymentMethods }) => {
    return (
      <div
        className="application-card"
        data-app-id={app.application_id}
        data-app-name={app.application_name}
      >
        <div className="card-image">
          <CldImage
            src={app.application_images[0]}
            alt={app.application_name}
            width={400}
            height={200}
            className="app-image"
            loading="lazy"
            quality="auto"
            format="auto"
          />
        </div>

        <div className="card-content">
          <h3 className="app-title">{app.application_name}</h3>

          <p className="app-meta">
            <span className="level">
              {getApplicationLevelLabel(app.application_level).long}
            </span>
            <span className="separator">•</span>
            <span className="category">{app.application_category}</span>
          </p>

          <div className="price-section">
            <div className="price-item">
              <span className="price-label">Frais d&apos;acquisition</span>
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
              onClick={() => onOrderClick(app)}
              disabled={!hasPaymentMethods}
              aria-label={`Commander ${app.application_name}`}
            >
              <FaDollarSign size={16} />
              <span className="btn-text">Commander</span>
            </button>
            <Link
              href={`/templates/${templateID}/applications/${app.application_id}`}
              className="btn btn-preview"
              onClick={() => onViewClick(app)}
              aria-label={`Voir détails de ${app.application_name}`}
            >
              <IoEye size={16} />
              <span className="btn-text">Voir +</span>
            </Link>
          </div>
        </div>
      </div>
    );
  },
);

ApplicationCard.displayName = 'ApplicationCard';

// Composant principal simplifié
const SingleTemplateShops = ({
  templateID,
  applications = [],
  platforms = [],
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [viewedApps, setViewedApps] = useState(new Set());

  // Tracking de la vue de la page (une seule fois)
  useEffect(() => {
    if (templateID && applications.length > 0) {
      const templateName = applications[0]?.template_name || 'Template';

      trackEvent('template_detail_view', {
        event_category: 'ecommerce',
        event_label: templateName,
        template_id: templateID,
        template_name: templateName,
        applications_count: applications.length,
        has_payment_methods: platforms.length > 0,
      });
    }
  }, []); // Dépendance vide intentionnelle

  // Handler pour l'ouverture de la modal de commande
  const handleOrderClick = useCallback(
    (app) => {
      // Vérifier les méthodes de paiement
      if (!platforms || platforms.length === 0) {
        alert('Aucune méthode de paiement disponible pour le moment');
        return;
      }

      // Tracker l'ouverture de commande
      trackEvent('order_start', {
        event_category: 'ecommerce',
        event_label: app.application_name,
        application_id: app.application_id,
        template_id: templateID,
        application_fee: app.application_fee,
        application_rent: app.application_rent,
      });

      setSelectedApp(app);
      setIsModalOpen(true);
    },
    [platforms, templateID],
  );

  // Handler pour voir les détails
  const handleApplicationView = useCallback(
    (app) => {
      // Tracker seulement si pas déjà vu
      if (!viewedApps.has(app.application_id)) {
        trackEvent('application_detail_click', {
          event_category: 'navigation',
          event_label: app.application_name,
          application_id: app.application_id,
          template_id: templateID,
        });

        setViewedApps((prev) => new Set([...prev, app.application_id]));
      }
    },
    [templateID, viewedApps],
  );

  // Handler pour fermer la modal
  const handleModalClose = useCallback(() => {
    if (selectedApp) {
      trackEvent('order_modal_close', {
        event_category: 'ecommerce',
        event_label: 'modal_closed',
        application_id: selectedApp.application_id,
      });
    }

    setIsModalOpen(false);
    setSelectedApp(null);
  }, [selectedApp]);

  // Gestion de l'état vide
  if (!applications || applications.length === 0) {
    return (
      <div className="template-empty">
        {/* ⭐ MANQUANT : PageTracker */}
        <PageTracker
          pageName={`template_${templateID}`}
          pageType="product_detail"
          sections={['hero', 'applications_list', 'order_interactions']}
        />
        ;
        <section className="first">
          <Parallax bgColor="#0c0c1d" title="Template" planets="/sun.png" />
        </section>
        <section className="empty-state">
          <h2>Aucune application disponible</h2>
          <p>Ce template n&apos;a pas encore d&apos;applications associées.</p>
          <Link href="/templates" className="cta-button">
            Voir d&apos;autres templates
          </Link>
        </section>
      </div>
    );
  }

  const templateName = applications[0]?.template_name || 'Template';
  const hasPaymentMethods = platforms && platforms.length > 0;

  return (
    <div className="single-template-container">
      <section className="first">
        <Parallax bgColor="#0c0c1d" title={templateName} planets="/sun.png" />
      </section>

      <div className="applications-list">
        {applications.map((app) => (
          <section
            key={app.application_id}
            className="others projectSection"
            role="article"
          >
            <ApplicationCard
              app={app}
              templateID={templateID}
              onOrderClick={handleOrderClick}
              onViewClick={handleApplicationView}
              hasPaymentMethods={hasPaymentMethods}
            />
          </section>
        ))}
      </div>

      {/* Modal de commande */}
      {selectedApp && (
        <OrderModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          platforms={platforms}
          applicationId={selectedApp.application_id}
          applicationFee={selectedApp.application_fee}
        />
      )}
    </div>
  );
};

export default SingleTemplateShops;
