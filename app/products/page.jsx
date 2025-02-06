'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MdOutlinePublic, MdEuro } from 'react-icons/md';
import { motion } from 'framer-motion';
import Parallax from '@/components/parallax';
import './products.scss';
import PaymentModal from '@/components/paymentModal';

const items = [
  {
    id: 1,
    image: '/e-commerce.jpg',
    category: 'Site Web',
    name: 'Boutique en Ligne L3',
    feePrice: '70 000',
    link: 'www.benew.com',
    description:
      'Site conçu pour un business de très petite taille. Destiné aux commerçants utilisant des pages Facebook.',
    rentPrice: '0',
  },
  {
    id: 2,
    image: '/e-commerce2.jpg',
    category: 'Site Web',
    name: 'Boutique en Ligne L5',
    feePrice: '90 000',
    link: 'www.benew.com',
    description:
      'Site conçu pour un business de très petite taille. Destiné aux commerçants utilisant des pages Facebook.',
    rentPrice: '0',
  },
];

function Products() {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    setIsOpen(true);
  };

  return (
    <div>
      <section className="first">
        <Parallax bgColor="#0c0c1d" title="Nos Boutiques" planets="/sun.png" />
      </section>
      {items.map((item) => (
        <section className="others" key={item.id}>
          <div className="container">
            {isOpen && <PaymentModal setIsOpen={setIsOpen} />}
            <div className="title">
              <h1>BOUTIQUE NOUVELLE GENERATION</h1>
            </div>
            <div className="contentContainer">
              <div className="imageContainer">
                <motion.img
                  className="image1"
                  src={item.image}
                  alt="product image"
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <div className="wrapper">
                <div className="textWrapper">
                  <h2>{item.category}</h2>
                  <h1>{item.name}</h1>
                  <ul>
                    <li>
                      <span>
                        <MdEuro />
                      </span>{' '}
                      {item.feePrice} fdj
                    </li>
                    <li>
                      <span>
                        <MdOutlinePublic />
                      </span>{' '}
                      {item.link}
                    </li>
                  </ul>
                  <p>{item.description}</p>
                  <h3>
                    Seulement pour <mark>{item.rentPrice} fdj/mois</mark>
                  </h3>
                  <div className="buttons">
                    <button
                      type="button"
                      className="buyBtn"
                      onClick={() => handleOpen()}
                    >
                      Location
                    </button>
                    <button type="button" className="moreBtn">
                      <Link href={`products/${item.id}`} className="info">
                        Plus d&apos;info
                      </Link>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

export default Products;
