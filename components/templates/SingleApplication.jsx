/* eslint-disable no-unused-vars */
'use client';

import { useState } from 'react';
import { CldImage } from 'next-cloudinary';
import Parallax from '../layouts/parallax';
import OrderModal from '../modal/OrderModal'; // Import the OrderModal component
import './styling/application.scss';
import Link from 'next/link';
import { formatPrice, getApplicationLevelLabel } from '@utils/helpers';
import { MdOutlineChevronLeft, MdOutlineChevronRight } from 'react-icons/md';

const SingleApplication = ({
  application,
  template,
  relatedApplications,
  platforms,
  adaptiveConfig,
  performanceMetrics,
  context,
}) => {
  // Get the images from the application object
  const images = (application && application.application_images) || [];

  // State to track the currently selected image
  const [selectedImage, setSelectedImage] = useState(images[0] || '');

  // State for modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Function to handle image selection
  const handleImageSelect = (image) => {
    setSelectedImage(image);
  };

  // Get app details
  const appDetails = application;

  // Format currency with the $ symbol
  const formatCurrency = (value) => {
    return `FDJ ${formatPrice(value)}`;
  };

  // Remplacer la fonction openOrderModal
  const openOrderModal = () => {
    // Vérifier si platforms existe et n'est pas un objet vide
    if (
      !platforms ||
      typeof platforms !== 'object' ||
      Object.keys(platforms).length === 0
    ) {
      alert('Aucune méthode de paiement disponible pour le moment');
      return;
    }
    setIsModalOpen(true);
  };

  // Function to close modal
  const closeOrderModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div>
      <section className="first">
        <Parallax
          bgColor="#0c0c1d"
          title={
            application &&
            typeof application === 'object' &&
            Object.keys(application).length > 0
              ? application.application_name
              : ''
          }
          planets="/sun.png"
        />
      </section>

      <section className="others gallery-section">
        {images.length > 0 ? (
          <div className="gallery-container">
            <div className="gallery-swiper-wrapper">
              {/* Image de gauche (avec blur) */}
              <div className="gallery-side-images gallery-left">
                {images.length > 2 && (
                  <>
                    {(() => {
                      const currentIndex = images.findIndex(
                        (img) => img === selectedImage,
                      );
                      const leftIndex =
                        currentIndex > 0 ? currentIndex - 1 : images.length - 1;

                      return (
                        <div
                          className="gallery-side-image"
                          key={`left-${leftIndex}`}
                        >
                          <CldImage
                            src={images[leftIndex]}
                            width={400}
                            height={600}
                            alt={`Application view ${leftIndex + 1}`}
                            className="side-image"
                            crop="fill"
                          />
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>

              {/* Flèche gauche */}
              {images.length > 1 && (
                <button
                  className="gallery-arrow gallery-arrow-left"
                  onClick={() => {
                    const currentIndex = images.findIndex(
                      (img) => img === selectedImage,
                    );
                    const prevIndex =
                      currentIndex > 0 ? currentIndex - 1 : images.length - 1;
                    setSelectedImage(images[prevIndex]);
                  }}
                >
                  <MdOutlineChevronLeft size={32} />
                </button>
              )}

              {/* Image principale au centre */}
              <div className="gallery-main-container">
                <div className="gallery-image-wrapper">
                  {selectedImage && (
                    <CldImage
                      key={selectedImage} // Clé unique pour forcer le re-render
                      src={selectedImage}
                      width={800}
                      height={1000}
                      alt="Featured application view"
                      className="gallery-main-image"
                      crop="fit"
                      sizes="(max-width: 768px) 90vw, 60vw"
                      placeholder="blur"
                      blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII="
                    />
                  )}
                </div>

                {/* Compteur d'images */}
                {images.length > 1 && (
                  <div className="gallery-counter">
                    {images.findIndex((img) => img === selectedImage) + 1} /{' '}
                    {images.length}
                  </div>
                )}
              </div>

              {/* Flèche droite */}
              {images.length > 1 && (
                <button
                  className="gallery-arrow gallery-arrow-right"
                  onClick={() => {
                    const currentIndex = images.findIndex(
                      (img) => img === selectedImage,
                    );
                    const nextIndex =
                      currentIndex < images.length - 1 ? currentIndex + 1 : 0;
                    setSelectedImage(images[nextIndex]);
                  }}
                >
                  <MdOutlineChevronRight size={32} />
                </button>
              )}

              {/* Image de droite (avec blur) */}
              <div className="gallery-side-images gallery-right">
                {images.length > 2 && (
                  <>
                    {(() => {
                      const currentIndex = images.findIndex(
                        (img) => img === selectedImage,
                      );
                      const rightIndex =
                        currentIndex < images.length - 1 ? currentIndex + 1 : 0;

                      return (
                        <div
                          className="gallery-side-image"
                          key={`right-${rightIndex}`}
                        >
                          <CldImage
                            src={images[rightIndex]}
                            width={400}
                            height={600}
                            alt={`Application view ${rightIndex + 1}`}
                            className="side-image"
                            crop="fill"
                          />
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="no-images">
            No images available for this application
          </div>
        )}
      </section>

      {/* SECTION 1 - En-tête et Informations techniques */}
      <section className="others app-header-section">
        {appDetails &&
        typeof appDetails === 'object' &&
        Object.keys(appDetails).length > 0 ? (
          <div className="app-header-container">
            {/* En-tête principal avec titre et template */}
            <div className="app-header">
              <div className="title-block">
                <h1 className="app-title">{appDetails.application_name}</h1>
                <div className="template-info">
                  <span className="template-label">Template:</span>
                  <span className="template-name">
                    {template?.template_name}
                  </span>
                </div>
              </div>

              <div className="app-badges">
                <div className="badge level-badge">
                  <span className="badge-value">
                    {
                      getApplicationLevelLabel(appDetails.application_level)
                        .short
                    }
                  </span>
                </div>
                <div className="badge category-badge compact">
                  <span className="badge-value">
                    {appDetails.application_category}
                  </span>
                </div>
              </div>
            </div>

            {/* Informations techniques */}
            <div className="info-card">
              <h3 className="card-title">Informations Techniques</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Niveau</span>
                  <span className="info-value">
                    {appDetails.application_level}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Catégorie</span>
                  <span className="info-value">
                    {appDetails.application_category}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="no-details">
            <div className="no-details-content">
              <h2>Aucune information disponible</h2>
              <p>
                Les détails de cette application ne sont pas disponibles pour le
                moment.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2 - Description, Tarification et Boutons d'actions */}
      <section className="others app-details-section">
        {appDetails &&
        typeof appDetails === 'object' &&
        Object.keys(appDetails).length > 0 ? (
          <div className="app-details-container">
            {/* Description */}
            <div className="description-card">
              <h2 className="section-title">
                Description de l&apos;application
              </h2>
              <div className="description-content">
                <p className="description-text">
                  {appDetails.application_description ||
                    'Aucune description disponible pour cette application.'}
                </p>
              </div>
            </div>

            {/* Carte des prix */}
            <div className="pricing-card">
              <h3 className="card-title">Tarification</h3>
              <div className="pricing-grid">
                <div className="price-item fee">
                  <span className="price-label">Frais d&apos;installation</span>
                  <span className="price-amount">
                    {formatCurrency(appDetails.application_fee)}
                  </span>
                </div>
                <div className="price-item rent">
                  <span className="price-label">Loyer mensuel</span>
                  <span className="price-amount">
                    {formatCurrency(appDetails.application_rent)}
                  </span>
                </div>
              </div>
              <div className="pricing-note">
                <small>Tous les prix sont en Francs Djiboutiens (FDJ)</small>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="action-buttons">
              <Link
                href={appDetails.application_link}
                className="btn btn-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="btn-icon">🚀</span>
                <span className="btn-text">Visiter l&apos;Application</span>
              </Link>

              {appDetails.application_admin_link && (
                <Link
                  href={appDetails.application_admin_link}
                  className="btn btn-secondary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="btn-icon">⚙️</span>
                  <span className="btn-text">Interface Admin</span>
                </Link>
              )}

              <button
                onClick={openOrderModal}
                className={`btn btn-accent ${!platforms || typeof platforms !== 'object' || Object.keys(platforms).length === 0 ? 'disabled' : ''}`}
                disabled={
                  !platforms ||
                  typeof platforms !== 'object' ||
                  Object.keys(platforms).length === 0
                }
              >
                <span className="btn-icon">💳</span>
                <span className="btn-text">
                  {!platforms ||
                  typeof platforms !== 'object' ||
                  Object.keys(platforms).length === 0
                    ? 'Paiement indisponible'
                    : 'Commander maintenant'}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="no-details">
            <div className="no-details-content">
              <h2>Aucune information disponible</h2>
              <p>
                Les détails de cette application ne sont pas disponibles pour le
                moment.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Order Modal */}
      {appDetails &&
        typeof appDetails === 'object' &&
        Object.keys(appDetails).length > 0 && (
          <OrderModal
            isOpen={isModalOpen}
            onClose={closeOrderModal}
            platforms={platforms}
            applicationId={appDetails.application_id}
            applicationFee={appDetails.application_fee}
          />
        )}
    </div>
  );
};

export default SingleApplication;
