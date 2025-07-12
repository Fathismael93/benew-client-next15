/* eslint-disable no-unused-vars */
'use client';

import { useState } from 'react';
import { CldImage } from 'next-cloudinary';
import Parallax from '../layouts/parallax';
import OrderModal from '../modal/OrderModal'; // Import the OrderModal component
import './styling/application.scss';
import Link from 'next/link';
import { formatPrice, getApplicationLevelLabel } from '@utils/helpers';

const SingleApplication = ({
  application,
  template,
  relatedApplications,
  platforms,
  adaptiveConfig,
  performanceMetrics,
  context,
}) => {
  // console.log('Application Data:', application);
  // console.log('Template Data:', template);
  // console.log('Related Applications:', relatedApplications);
  // console.log('Platforms:', platforms);
  // console.log('Adaptive Config:', adaptiveConfig);
  // console.log('Performance Metrics:', performanceMetrics);
  // console.log('Context:', context);

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
            <div className="gallery-content-wrapper">
              <div className="gallery-swiper-container">
                {selectedImage && (
                  <CldImage
                    src={selectedImage}
                    width={1200}
                    height={800}
                    alt="Featured application view"
                    className="gallery-main-image"
                    crop="fit"
                    sizes="(max-width: 768px) 100vw, 90vw"
                    placeholder="blur"
                    blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII="
                  />
                )}

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
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="15,18 9,12 15,6"></polyline>
                    </svg>
                  </button>
                )}

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
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="9,6 15,12 9,18"></polyline>
                    </svg>
                  </button>
                )}

                {/* Indicateurs de pagination */}
                {images.length > 1 && (
                  <div className="gallery-pagination">
                    {images.map((_, index) => (
                      <button
                        key={index}
                        className={`gallery-dot ${images[index] === selectedImage ? 'active' : ''}`}
                        onClick={() => setSelectedImage(images[index])}
                      />
                    ))}
                  </div>
                )}

                {/* Compteur d'images */}
                {images.length > 1 && (
                  <div className="gallery-counter">
                    {images.findIndex((img) => img === selectedImage) + 1} /{' '}
                    {images.length}
                  </div>
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

      <section className="others details-section">
        {appDetails &&
        typeof appDetails === 'object' &&
        Object.keys(appDetails).length > 0 ? (
          <div className="details-container">
            <div className="details-content-wrapper">
              <div className="details-header">
                <h2>{appDetails.application_name}</h2>
                <div className="details-badges">
                  <span className="details-badge type-badge">
                    {`Type ${appDetails.application_level}`}
                  </span>
                  <span className="details-badge category-badge">
                    {appDetails.application_category}
                  </span>
                </div>
              </div>

              <div className="details-grid">
                <div className="details-description">
                  <h3>Description</h3>
                  <p className="description-text">
                    {appDetails.application_description ||
                      'No description available.'}
                  </p>

                  <div className="details-actions">
                    <Link
                      href={appDetails.application_link}
                      className="details-button secondary"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="button-icon">🚀</span>
                      Visit Application
                    </Link>
                    <button
                      onClick={openOrderModal}
                      className={`details-button primary ${!platforms || typeof platforms !== 'object' || Object.keys(platforms).length === 0 ? 'disabled' : ''}`}
                      disabled={
                        !platforms ||
                        typeof platforms !== 'object' ||
                        Object.keys(platforms).length === 0
                      }
                    >
                      <span className="button-icon">💳</span>
                      {!platforms ||
                      typeof platforms !== 'object' ||
                      Object.keys(platforms).length === 0
                        ? 'Paiement indisponible'
                        : 'Commander'}
                    </button>
                  </div>
                </div>

                <div className="details-info-card">
                  <h3>Application Details</h3>
                  <ul className="details-list">
                    <li>
                      <span className="details-label">Type</span>
                      <span className="details-value">
                        {getApplicationLevelLabel(appDetails.application_level)}
                      </span>
                    </li>
                    <li>
                      <span className="details-label">Category</span>
                      <span className="details-value">
                        {appDetails.application_category}
                      </span>
                    </li>
                    <li>
                      <span className="details-label">Fee</span>
                      <span className="details-value">
                        {formatCurrency(appDetails.application_fee)}
                      </span>
                    </li>
                    <li>
                      <span className="details-label">Rent</span>
                      <span className="details-value">
                        {formatCurrency(appDetails.application_rent)}
                      </span>
                    </li>
                    {platforms &&
                      typeof platforms === 'object' &&
                      Object.keys(platforms).length > 0 && (
                        <li className="platforms-list-item">
                          <span className="details-label">Platforms</span>
                          <div className="platform-badges-small">
                            {Object.values(platforms).map((platform, index) => (
                              <span
                                key={index}
                                className="platform-badge-small"
                              >
                                {platform.platform_name}
                              </span>
                            ))}
                          </div>
                        </li>
                      )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="no-details">
            No details available for this application
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
