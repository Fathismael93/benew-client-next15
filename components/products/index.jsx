'use client';

// ShopCard.jsx
import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const ShopCard = ({ product, onOrder }) => {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="fullscreen-card">
      <div className="image-container">
        <Image
          src={product.image}
          alt={product.title}
          fill
          style={{ objectFit: 'cover' }}
          priority
        />
        <div className="overlay">
          <h2 className="title">{product.title}</h2>
          <button
            className="info-toggle"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? '− Hide Info' : '+ Show Info'}
          </button>
        </div>
        <div className={`details-panel ${showDetails ? 'show' : ''}`}>
          <ul className="details">
            <li>Type: {product.type}</li>
            <li>Prix: {product.price}</li>
            <li>Charges à payer/Mois: {product.charges}</li>
            <li>
              <Link href={product.link}>Voir sur le site</Link>
            </li>
          </ul>
          <div className="buttons">
            <button className="orderButton" onClick={onOrder}>
              Commander
            </button>
            <Link href={`/products/${product.id}`} className="detailsButton">
              Plus de détails
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopCard;
