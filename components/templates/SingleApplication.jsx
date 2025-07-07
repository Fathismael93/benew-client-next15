'use client';

import { useState } from 'react';
import { CldImage } from 'next-cloudinary';
import Parallax from '../layouts/parallax';
import OrderModal from '../modal/OrderModal'; // Import the OrderModal component
import './styling/application.scss';
import Link from 'next/link';

const SingleApplication = ({
  application,
  template,
  relatedApplications,
  platforms,
  adaptiveConfig,
  performanceMetrics,
  context,
}) => {
  console.log('Application Data:', application);
  console.log('Template Data:', template);
  console.log('Related Applications:', relatedApplications);
  console.log('Platforms:', platforms);
  console.log('Adaptive Config:', adaptiveConfig);
  console.log('Performance Metrics:', performanceMetrics);
  console.log('Context:', context);
  // Get the images from the first application
  const images = (application && application[0]?.application_images) || [];

  // State to track the currently selected image
  const [selectedImage, setSelectedImage] = useState(images[0] || '');

  // State for modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Function to handle image selection
  const handleImageSelect = (image) => {
    setSelectedImage(image);
  };

  // Get app details
  const appDetails = application && application[0];

  // Format currency with the $ symbol
  const formatCurrency = (value) => {
    return `$${parseFloat(value).toFixed(2)}`;
  };

  // Remplacer la fonction openOrderModal
  const openOrderModal = () => {
    // Vérifier si platforms existe et n'est pas vide
    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
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
      <section className="others">
        <Parallax
          bgColor="#0c0c1d"
          title={
            application !== undefined ? application[0]?.application_name : ''
          }
          planets="/sun.png"
        />
      </section>

      <section className="others gallery-section">
        {images.length > 0 ? (
          <div className="gallery-container">
            <div className="gallery-content-wrapper">
              <div className="gallery-image-container">
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
              </div>

              <div className="gallery-thumbnail-wrapper">
                {images.map((image, index) => (
                  <div
                    key={index}
                    className={`gallery-thumbnail ${selectedImage === image ? 'active' : ''}`}
                    onClick={() => handleImageSelect(image)}
                  >
                    <CldImage
                      src={image}
                      width={120}
                      height={120}
                      alt={`Application view ${index + 1}`}
                      className="thumbnail-image"
                      crop="fill"
                    />
                  </div>
                ))}
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
        {appDetails ? (
          <div className="details-container">
            <div className="details-content-wrapper">
              <div className="details-header">
                <h2>{appDetails.application_name}</h2>
                <div className="details-badges">
                  <span className="details-badge type-badge">
                    {appDetails.application_type}
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
                      className={`details-button primary ${!platforms || platforms.length === 0 ? 'disabled' : ''}`}
                      disabled={!platforms || platforms.length === 0}
                    >
                      <span className="button-icon">💳</span>
                      {!platforms || platforms.length === 0
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
                        {appDetails.application_type}
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
                    {platforms && platforms.length > 0 && (
                      <li className="platforms-list-item">
                        <span className="details-label">Platforms</span>
                        <div className="platform-badges-small">
                          {platforms.map((platform, index) => (
                            <span key={index} className="platform-badge-small">
                              {platform.platform_name}
                            </span>
                          ))}
                        </div>
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {appDetails.application_other_versions &&
                appDetails.application_other_versions.length > 0 && (
                  <div className="details-other-versions">
                    <h3>Other Versions</h3>
                    <div className="version-links">
                      {appDetails.application_other_versions.map(
                        (version, index) => (
                          <a
                            key={index}
                            href={version}
                            className="version-link"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Version {index + 1}
                          </a>
                        ),
                      )}
                    </div>
                  </div>
                )}
            </div>
          </div>
        ) : (
          <div className="no-details">
            No details available for this application
          </div>
        )}
      </section>

      {/* Order Modal */}
      {appDetails && (
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
