'use client';

import React, { useState } from 'react';
import { MdOutlinePublic, MdEuro } from 'react-icons/md';
import PaymentModal from '@/components/paymentModal';
import './singleProduct.scss';

function SingleProduct() {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    setIsOpen(true);
  };

  return (
    <div className="container">
      <div className="product-wrapper">
        {isOpen && <PaymentModal setIsOpen={setIsOpen} />}
        <div className="product-images">
          <div className="image-thumbnail">
            <img src="/e-commerce.jpg" alt="principal product" />
            <div className="images-small">
              <img
                src="/e-commerce2.jpg"
                alt="other images"
                className="active"
              />
              <img src="/e-commerce3.jpg" alt="other images" />
              <img src="/e-commerce4.jpg" alt="other images" />
              <img src="/e-commerce5.jpg" alt="other images" />
            </div>
          </div>
        </div>
        <div className="product-content">
          <div className="textWrapper">
            <h2>Site Web</h2>
            <h1>Boutique en Ligne L3</h1>
            <ul>
              <li>
                <span>
                  <MdEuro />
                </span>{' '}
                Frais de dossier de 70 000 fdj
              </li>
              <li>
                <span>
                  <MdOutlinePublic />
                </span>{' '}
                Visiter la boutique sur <span>www.benew.com</span>
              </li>
            </ul>
            <p>
              Site conçu pour un business de très petite taille.
              <br /> Destiné aux commerçants utilisant des pages Facebook.
            </p>
            <h3>0 fdj/mois</h3>
            <button type="button" onClick={() => handleOpen()}>
              Location
            </button>
          </div>
        </div>
      </div>
      <div className="details-choice">
        <ul>
          <li>Caractéristiques</li>
          <li>Motivation</li>
          <li>Booster</li>
        </ul>
      </div>
    </div>
  );
}

export default SingleProduct;
