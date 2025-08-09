/* eslint-disable no-unused-vars */
// components/templates/SingleApplication.jsx
'use client';

import dynamic from 'next/dynamic';
import './appStyles/index.scss';
import { useEffect, useState, useCallback, memo } from 'react';
import { CldImage } from 'next-cloudinary';
import Link from 'next/link';
import { MdOutlineChevronLeft, MdOutlineChevronRight } from 'react-icons/md';

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

// Composant de navigation de galerie mémorisé
const GalleryNavigation = memo(
  ({ images, selectedImage, onImageSelect, onNavigate }) => {
    const currentIndex = images.findIndex((img) => img === selectedImage);

    return (
      <div className="gallery-container">
        <div className="gallery-swiper-wrapper">
          {/* Image de gauche */}
          <div className="gallery-side-images gallery-left">
            {images.length > 2 && (
              <div className="gallery-side-image">
                <CldImage
                  src={
                    images[
                      currentIndex > 0 ? currentIndex - 1 : images.length - 1
                    ]
                  }
                  width={400}
                  height={600}
                  alt={`Application view ${currentIndex > 0 ? currentIndex : images.length}`}
                  className="side-image"
                  crop="fill"
                  loading="lazy"
                  quality="auto"
                  format="auto"
                />
              </div>
            )}
          </div>

          {/* Flèche gauche */}
          {images.length > 1 && (
            <button
              className="gallery-arrow gallery-arrow-left"
              onClick={() => onNavigate('prev')}
              aria-label="Image précédente"
            >
              <MdOutlineChevronLeft size={32} />
            </button>
          )}

          {/* Image principale */}
          <div className="gallery-main-container">
            <div className="gallery-image-wrapper">
              <CldImage
                key={selectedImage}
                src={selectedImage}
                width={800}
                height={1000}
                alt="Vue principale de l'application"
                className="gallery-main-image"
                crop="fit"
                sizes="(max-width: 768px) 90vw, 60vw"
                loading="eager"
                quality="auto"
                format="auto"
              />
            </div>

            {/* Compteur d'images */}
            {images.length > 1 && (
              <div className="gallery-counter">
                {currentIndex + 1} / {images.length}
              </div>
            )}
          </div>

          {/* Flèche droite */}
          {images.length > 1 && (
            <button
              className="gallery-arrow gallery-arrow-right"
              onClick={() => onNavigate('next')}
              aria-label="Image suivante"
            >
              <MdOutlineChevronRight size={32} />
            </button>
          )}

          {/* Image de droite */}
          <div className="gallery-side-images gallery-right">
            {images.length > 2 && (
              <div className="gallery-side-image">
                <CldImage
                  src={
                    images[
                      currentIndex < images.length - 1 ? currentIndex + 1 : 0
                    ]
                  }
                  width={400}
                  height={600}
                  alt={`Application view ${currentIndex < images.length - 1 ? currentIndex + 2 : 1}`}
                  className="side-image"
                  crop="fill"
                  loading="lazy"
                  quality="auto"
                  format="auto"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

GalleryNavigation.displayName = 'GalleryNavigation';

// Composant des informations techniques mémorisé
const TechnicalInfo = memo(({ application, template, onExternalLinkClick }) => (
  <div className="technical-section" id="technical-content">
    <h3 className="section-title">Informations Techniques</h3>
    <div className="info-table-container">
      <table className="info-table">
        <tbody>
          <tr className="info-row">
            <td className="info-label">Template</td>
            <td className="info-value">
              {template?.template_name || 'Non spécifié'}
            </td>
          </tr>
          <tr className="info-row">
            <td className="info-label">Type d&apos;application</td>
            <td className="info-value">
              {getApplicationLevelLabel(application.application_level).long} (
              {getApplicationLevelLabel(application.application_level).short})
            </td>
          </tr>
          <tr className="info-row">
            <td className="info-label">Niveau</td>
            <td className="info-value">{application.application_level}</td>
          </tr>
          <tr className="info-row">
            <td className="info-label">Catégorie</td>
            <td className="info-value">{application.application_category}</td>
          </tr>
          <tr className="info-row">
            <td className="info-label">Lien boutique</td>
            <td className="info-value">
              <Link
                href={application.application_link}
                target="_blank"
                rel="noopener noreferrer"
                className="info-link"
                onClick={() =>
                  onExternalLinkClick(
                    'store',
                    application.application_link,
                    'Voir la boutique',
                  )
                }
              >
                Voir la boutique
              </Link>
            </td>
          </tr>
          {application.application_admin_link && (
            <tr className="info-row">
              <td className="info-label">Gestion boutique</td>
              <td className="info-value">
                <Link
                  href={application.application_admin_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="info-link"
                  onClick={() =>
                    onExternalLinkClick(
                      'admin',
                      application.application_admin_link,
                      'Interface admin',
                    )
                  }
                >
                  Interface admin
                </Link>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
));

TechnicalInfo.displayName = 'TechnicalInfo';

// Composant des besoins spécifiques mémorisé
const SpecificNeeds = memo(() => (
  <div className="needs-section">
    <h3 className="section-title">Besoins spécifiques de l&apos;application</h3>
    <div className="needs-table-container">
      <table className="needs-table">
        <tbody>
          <tr className="needs-row">
            <td className="needs-item">
              <span className="needs-icon">🌐</span>
              <span className="needs-text">Un hébergement web</span>
            </td>
          </tr>
          <tr className="needs-row">
            <td className="needs-item">
              <span className="needs-icon">💾</span>
              <span className="needs-text">
                Un hébergement de base de données
              </span>
            </td>
          </tr>
          <tr className="needs-row">
            <td className="needs-item">
              <span className="needs-icon">🔗</span>
              <span className="needs-text">
                Un nom de domaine (.com, .org, ...)
              </span>
            </td>
          </tr>
          <tr className="needs-row">
            <td className="needs-item">
              <span className="needs-icon">📧</span>
              <span className="needs-text">Un email professionnel</span>
            </td>
          </tr>
          <tr className="needs-row free-tools">
            <td className="needs-item">
              <span className="needs-icon">🎁</span>
              <span className="needs-text">
                Tous les autres outils nécessaires sont offerts gratuitement
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
));

SpecificNeeds.displayName = 'SpecificNeeds';

// Composant de tarification mémorisé
const PricingSection = memo(({ application }) => {
  const formatCurrency = (value) => `FDJ ${formatPrice(value)}`;

  return (
    <div className="pricing-section">
      <h3 className="section-title">Tarification</h3>
      <div className="pricing-table-container">
        <table className="pricing-table">
          <tbody>
            <tr className="pricing-row">
              <td className="pricing-label">Frais d&apos;acquisition</td>
              <td className="pricing-value">
                {formatCurrency(application.application_fee)}
              </td>
            </tr>
            <tr className="pricing-row">
              <td className="pricing-label">Frais de gestion</td>
              <td className="pricing-value">
                {formatCurrency(application.application_rent)}
              </td>
            </tr>
            <tr className="pricing-row total-row">
              <td className="pricing-label">Total</td>
              <td className="pricing-value">
                {formatCurrency(
                  application.application_fee + application.application_rent,
                )}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="pricing-note">
          <small>Tous les prix sont en Francs Djiboutiens (FDJ)</small>
        </div>
      </div>
    </div>
  );
});

PricingSection.displayName = 'PricingSection';

// Composant principal simplifié
const SingleApplication = ({ application, template, platforms, context }) => {
  const images = application?.application_images || [];
  const [selectedImage, setSelectedImage] = useState(images[0] || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeContentSection, setActiveContentSection] =
    useState('description');
  const [activePricingSection, setActivePricingSection] = useState('needs');

  // Tracking de la page view (une seule fois)
  useEffect(() => {
    if (context?.applicationId && application?.application_name) {
      trackEvent('application_page_view', {
        event_category: 'application',
        event_label: application.application_name,
        application_id: context.applicationId,
        template_id: context.templateId,
        application_name: application.application_name,
        application_level: application.application_level,
        application_category: application.application_category,
        has_images: images.length > 0,
        images_count: images.length,
      });
    }
  }, []); // Dépendance vide intentionnelle

  // Handler pour la navigation dans la galerie
  const handleImageNavigation = useCallback(
    (direction) => {
      const currentIndex = images.findIndex((img) => img === selectedImage);
      let nextIndex;

      if (direction === 'next') {
        nextIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
      }

      setSelectedImage(images[nextIndex]);

      // Tracking simplifié
      trackEvent('gallery_navigation', {
        event_category: 'gallery',
        event_label: direction,
        application_id: context?.applicationId,
      });
    },
    [selectedImage, images, context?.applicationId],
  );

  // Handler pour les toggles de contenu
  const handleContentToggle = useCallback(
    (section) => {
      setActiveContentSection(section);

      trackEvent('content_toggle', {
        event_category: 'ui_interaction',
        event_label: section,
        application_id: context?.applicationId,
      });
    },
    [context?.applicationId],
  );

  // Handler pour les toggles de section pricing
  const handlePricingSectionToggle = useCallback(
    (section) => {
      setActivePricingSection(section);

      trackEvent('pricing_section_toggle', {
        event_category: 'ui_interaction',
        event_label: section,
        application_id: context?.applicationId,
      });
    },
    [context?.applicationId],
  );

  // Handler pour les liens externes
  const handleExternalLinkClick = useCallback(
    (linkType, url, linkText) => {
      trackEvent('external_link_click', {
        event_category: 'navigation',
        event_label: linkText,
        link_type: linkType,
        application_id: context?.applicationId,
      });
    },
    [context?.applicationId],
  );

  // Handler pour ouvrir la modal de commande
  const handleOrderModalOpen = useCallback(() => {
    // Vérifier les méthodes de paiement
    if (
      !platforms ||
      typeof platforms !== 'object' ||
      Object.keys(platforms).length === 0
    ) {
      trackEvent('order_modal_failed', {
        event_category: 'ecommerce',
        event_label: 'no_payment_methods',
        application_id: context?.applicationId,
      });
      alert('Aucune méthode de paiement disponible pour le moment');
      return;
    }

    trackEvent('order_modal_open', {
      event_category: 'ecommerce',
      event_label: application.application_name,
      application_id: context?.applicationId,
      template_id: context?.templateId,
      application_fee: application.application_fee,
      application_rent: application.application_rent,
    });

    setIsModalOpen(true);
  }, [platforms, context, application]);

  // Handler pour fermer la modal
  const handleModalClose = useCallback(() => {
    trackEvent('order_modal_close', {
      event_category: 'ecommerce',
      event_label: 'modal_closed',
      application_id: context?.applicationId,
    });

    setIsModalOpen(false);
  }, [context?.applicationId]);

  // Gestion de l'état vide
  if (
    !application ||
    typeof application !== 'object' ||
    Object.keys(application).length === 0
  ) {
    return (
      <div className="application-empty">
        <PageTracker
          pageName={`application_${context.applicationId}`}
          pageType="product_detail"
          sections={[
            'gallery',
            'description',
            'technical_info',
            'pricing',
            'order_action',
          ]}
        />
        <section className="first">
          <Parallax bgColor="#0c0c1d" title="Application" planets="/sun.png" />
        </section>
        <section className="empty-state">
          <h2>Application non trouvée</h2>
          <p>Cette application n&apos;est pas disponible pour le moment.</p>
          <Link href="/templates" className="cta-button">
            Voir nos templates
          </Link>
        </section>
      </div>
    );
  }

  const hasPaymentMethods =
    platforms &&
    typeof platforms === 'object' &&
    Object.keys(platforms).length > 0;

  return (
    <div>
      <section className="first">
        <Parallax
          bgColor="#0c0c1d"
          title={application.application_name}
          planets="/sun.png"
        />
      </section>

      {/* Section Galerie */}
      <section className="others gallery-section">
        {images.length > 0 ? (
          <GalleryNavigation
            images={images}
            selectedImage={selectedImage}
            onImageSelect={setSelectedImage}
            onNavigate={handleImageNavigation}
          />
        ) : (
          <div className="no-images">
            No images available for this application
          </div>
        )}
      </section>

      {/* Section En-tête et Informations */}
      <section className="others app-header-section">
        <div className="app-header-container">
          <div className="app-header">
            <div className="title-block">
              <h1 className="app-title">{application.application_name}</h1>
            </div>

            <div className="app-badges">
              <div className="badge level-badge">
                <span className="badge-value">
                  {
                    getApplicationLevelLabel(application.application_level)
                      .short
                  }
                </span>
              </div>
              <div className="badge category-badge">
                <span className="badge-value">
                  {application.application_category}
                </span>
              </div>
            </div>
          </div>

          <div className="main-content">
            {/* Boutons de toggle mobile */}
            <div className="mobile-toggle-buttons">
              <button
                className={`toggle-btn ${activeContentSection === 'description' ? 'active' : ''}`}
                onClick={() => handleContentToggle('description')}
              >
                <span className="toggle-icon">📄</span>
                <span className="toggle-text">Description</span>
              </button>
              <button
                className={`toggle-btn ${activeContentSection === 'technical' ? 'active' : ''}`}
                onClick={() => handleContentToggle('technical')}
              >
                <span className="toggle-icon">⚙️</span>
                <span className="toggle-text">Technique</span>
              </button>
            </div>

            <div className="content-grid">
              {/* Description */}
              <div
                className={`description-section ${activeContentSection === 'description' ? 'active' : ''}`}
              >
                <h2 className="section-title">
                  Description de l&apos;application
                </h2>
                <div className="description-content">
                  <p className="description-text">
                    {application.application_description ||
                      'Aucune description disponible pour cette application.'}
                  </p>
                </div>
              </div>

              {/* Informations techniques */}
              <div
                className={activeContentSection === 'technical' ? 'active' : ''}
              >
                <TechnicalInfo
                  application={application}
                  template={template}
                  onExternalLinkClick={handleExternalLinkClick}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section Tarification */}
      <section className="others app-details-section">
        <div className="app-details-container">
          {/* Navigation mobile pour pricing */}
          <div className="mobile-section-nav">
            <button
              className={`section-btn ${activePricingSection === 'needs' ? 'active' : ''}`}
              onClick={() => handlePricingSectionToggle('needs')}
            >
              <span className="btn-icon">📋</span>
              <span className="btn-text">Besoins spécifiques</span>
            </button>
            <button
              className={`section-btn ${activePricingSection === 'pricing' ? 'active' : ''}`}
              onClick={() => handlePricingSectionToggle('pricing')}
            >
              <span className="btn-icon">💰</span>
              <span className="btn-text">Tarification</span>
            </button>
          </div>

          <div className="purchase-grid">
            {/* Besoins spécifiques */}
            <div
              className={`${activePricingSection === 'needs' ? 'active' : ''}`}
            >
              <SpecificNeeds />
            </div>

            {/* Tarification */}
            <div
              className={`${activePricingSection === 'pricing' ? 'active' : ''}`}
            >
              <PricingSection application={application} />
            </div>
          </div>

          {/* Bouton commander */}
          <div className="order-button-container">
            <button
              onClick={handleOrderModalOpen}
              className={`btn btn-primary purchase-btn ${!hasPaymentMethods ? 'disabled' : ''}`}
              disabled={!hasPaymentMethods}
            >
              <span className="btn-icon">💳</span>
              <span className="btn-text">
                {!hasPaymentMethods
                  ? 'Paiement indisponible'
                  : 'Commander maintenant'}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Modal de commande */}
      <OrderModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        platforms={platforms}
        applicationId={application.application_id}
        applicationFee={application.application_fee}
      />
    </div>
  );
};

export default SingleApplication;
