'use client';

import React, { useState } from 'react';
import { CldImage } from 'next-cloudinary';
import Parallax from '../layouts/parallax';
import './styling/application.scss';

const SingleApplication = ({ application, platforms }) => {
  console.log('Single application data: ');
  console.log(application);

  console.log('platforms data: ');
  console.log(platforms);

  // Get the images from the first application
  const images = (application && application[0]?.application_images) || [];

  // State to track the currently selected image
  const [selectedImage, setSelectedImage] = useState(images[0] || '');

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
                  <p>
                    {appDetails.application_description ||
                      'No description available.'}
                  </p>

                  <div className="details-actions">
                    <a
                      href={appDetails.application_link}
                      className="details-button primary"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="button-icon">🚀</span>
                      Visit Application
                    </a>
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
                    <li>
                      <span className="details-label">Template ID</span>
                      <span className="details-value">
                        {appDetails.application_template_id}
                      </span>
                    </li>
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

              {platforms && platforms.length > 0 && (
                <div className="details-platforms">
                  <h3>Available Platforms</h3>
                  <div className="platform-badges">
                    {platforms.map((platform, index) => (
                      <span key={index} className="platform-badge">
                        {platform.platform_name}
                      </span>
                    ))}
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
    </div>
  );
};

export default SingleApplication;
