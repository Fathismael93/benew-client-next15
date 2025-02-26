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
                    width={1000}
                    height={800}
                    alt="Featured application view"
                    className="gallery-main-image"
                    crop="fill"
                    sizes="(max-width: 768px) 100vw, 50vw"
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
    </div>
  );
};

export default SingleApplication;
