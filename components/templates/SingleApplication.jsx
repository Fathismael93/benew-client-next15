/* eslint-disable no-unused-vars */
'use client';

import { useEffect, useState } from 'react';
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

  // État pour la navigation mobile section 2
  const [activePricingSection, setActivePricingSection] = useState('needs');

  // Ajoutez ceci juste avant le return, après la fonction closeOrderModal
  useEffect(() => {
    const toggleButtons = document.querySelectorAll('.toggle-btn');
    const descriptionContent = document.getElementById('description-content');
    const technicalContent = document.getElementById('technical-content');

    const handleToggle = (e) => {
      const target = e.currentTarget.getAttribute('data-target');

      // Supprimer la classe active de tous les boutons
      toggleButtons.forEach((btn) => btn.classList.remove('active'));

      // Ajouter la classe active au bouton cliqué
      e.currentTarget.classList.add('active');

      if (target === 'description') {
        descriptionContent?.classList.add('active');
        technicalContent?.classList.remove('active');
      } else {
        technicalContent?.classList.add('active');
        descriptionContent?.classList.remove('active');
      }
    };

    toggleButtons.forEach((button) => {
      button.addEventListener('click', handleToggle);
    });

    // Cleanup
    return () => {
      toggleButtons.forEach((button) => {
        button.removeEventListener('click', handleToggle);
      });
    };
  }, []);

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
            {/* En-tête principal avec titre et badges */}
            <div className="app-header">
              <div className="title-block">
                <h1 className="app-title">{appDetails.application_name}</h1>
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
                <div className="badge category-badge">
                  <span className="badge-value">
                    {appDetails.application_category}
                  </span>
                </div>
              </div>
            </div>

            {/* Contenu principal : Description + Informations techniques */}
            <div className="main-content">
              {/* Boutons de toggle mobile */}
              <div className="mobile-toggle-buttons">
                <button className="toggle-btn active" data-target="description">
                  <span className="toggle-icon">📄</span>
                  <span className="toggle-text">Description</span>
                </button>
                <button className="toggle-btn" data-target="technical">
                  <span className="toggle-icon">⚙️</span>
                  <span className="toggle-text">Technique</span>
                </button>
              </div>

              <div className="content-grid">
                {/* Description à gauche */}
                <div
                  className="description-section active"
                  id="description-content"
                >
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

                {/* Informations techniques à droite */}
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
                          <td className="info-label">
                            Type d&apos;application
                          </td>
                          <td className="info-value">
                            {
                              getApplicationLevelLabel(
                                appDetails.application_level,
                              ).long
                            }{' '}
                            (
                            {
                              getApplicationLevelLabel(
                                appDetails.application_level,
                              ).short
                            }
                            )
                          </td>
                        </tr>
                        <tr className="info-row">
                          <td className="info-label">Niveau</td>
                          <td className="info-value">
                            {appDetails.application_level}
                          </td>
                        </tr>
                        <tr className="info-row">
                          <td className="info-label">Catégorie</td>
                          <td className="info-value">
                            {appDetails.application_category}
                          </td>
                        </tr>
                        <tr className="info-row">
                          <td className="info-label">Lien boutique</td>
                          <td className="info-value">
                            <Link
                              href={appDetails.application_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="info-link"
                            >
                              Voir la boutique
                            </Link>
                          </td>
                        </tr>
                        {appDetails.application_admin_link && (
                          <tr className="info-row">
                            <td className="info-label">Gestion boutique</td>
                            <td className="info-value">
                              <Link
                                href={appDetails.application_admin_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="info-link"
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

      {/* SECTION 2 - Tarification et Boutons d'actions */}
      <section className="others app-details-section">
        {appDetails &&
        typeof appDetails === 'object' &&
        Object.keys(appDetails).length > 0 ? (
          <div className="app-details-container">
            {/* Boutons de toggle mobile pour section 2 */}
            <div className="mobile-section-nav">
              <button
                className={`section-btn ${activePricingSection === 'needs' ? 'active' : ''}`}
                onClick={() => setActivePricingSection('needs')}
              >
                <span className="btn-icon">📋</span>
                <span className="btn-text">Besoins spécifiques</span>
              </button>
              <button
                className={`section-btn ${activePricingSection === 'pricing' ? 'active' : ''}`}
                onClick={() => setActivePricingSection('pricing')}
              >
                <span className="btn-icon">💰</span>
                <span className="btn-text">Tarification</span>
              </button>
            </div>

            <div className="purchase-grid">
              {/* Section besoins spécifiques à gauche */}
              <div
                className={`needs-section ${activePricingSection === 'needs' ? 'active' : ''}`}
              >
                <h3 className="section-title">
                  Besoins spécifiques de l&apos;application
                </h3>
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
                          <span className="needs-text">
                            Un email professionnel
                          </span>
                        </td>
                      </tr>
                      <tr className="needs-row free-tools">
                        <td className="needs-item">
                          <span className="needs-icon">🎁</span>
                          <span className="needs-text">
                            Tous les autres outils nécessaires sont offerts
                            gratuitement
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section tarification à droite (gardée identique) */}
              <div
                className={`pricing-section ${activePricingSection === 'pricing' ? 'active' : ''}`}
              >
                <h3 className="section-title">Tarification</h3>
                <div className="pricing-table-container">
                  <table className="pricing-table">
                    <tbody>
                      <tr className="pricing-row">
                        <td className="pricing-label">
                          Frais d&apos;acquisition
                        </td>
                        <td className="pricing-value">
                          {formatCurrency(appDetails.application_fee)}
                        </td>
                      </tr>
                      <tr className="pricing-row">
                        <td className="pricing-label">Frais de gestion</td>
                        <td className="pricing-value">
                          {formatCurrency(appDetails.application_rent)}
                        </td>
                      </tr>
                      <tr className="pricing-row total-row">
                        <td className="pricing-label">Total</td>
                        <td className="pricing-value">
                          {formatCurrency(
                            appDetails.application_fee +
                              appDetails.application_rent,
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="pricing-note">
                    <small>
                      Tous les prix sont en Francs Djiboutiens (FDJ)
                    </small>
                  </div>
                </div>
              </div>
            </div>

            {/* Bouton commander en dessous */}
            <div className="order-button-container">
              <button
                onClick={openOrderModal}
                className={`btn btn-primary purchase-btn ${!platforms || typeof platforms !== 'object' || Object.keys(platforms).length === 0 ? 'disabled' : ''}`}
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
