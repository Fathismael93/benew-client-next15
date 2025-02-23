'use client';

import React, { useState } from 'react';
import ShopCard from '@/components/products';
import OrderModal from '@/components/modal';
import './templateShops.scss';
import Parallax from '@/components/parallax';

const TemplateShops = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const products = [
    {
      id: 1,
      image: '/e-commerce4.jpg',
      title: 'Local Commercial - Centre Ville',
      type: 'Boutique simple (BS)',
      price: '70 000 fdj',
      charges: '15000 fdj',
      link: 'https://benew-client-next15.vercel.app/products',
    },
    {
      id: 2,
      image: '/e-commerce5.jpg',
      title: 'Local Commercial - Centre Ville',
      type: 'Boutique simple (BS)',
      price: '70 000 fdj',
      charges: '15000 fdj',
      link: 'https://benew-client-next15.vercel.app/products',
    },
    {
      id: 2,
      image: '/e-commerce3.jpg',
      title: 'Local Commercial - Centre Ville',
      type: 'Boutique simple (BS)',
      price: '70 000 fdj',
      charges: '15000 fdj',
      link: 'https://benew-client-next15.vercel.app/products',
    },
    // Ajoutez d'autres produits ici
  ];

  return (
    <div>
      <section className="others">
        <Parallax
          bgColor="#0c0c1d"
          title="BUY IT NOW SHOPS"
          planets="/sun.png"
        />
      </section>
      <section className="others productsContainer">
        {products.map((product) => (
          <ShopCard
            key={product.id}
            product={product}
            onOrder={() => setIsModalOpen(true)}
          />
        ))}
        <OrderModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      </section>
    </div>
  );
};

export default TemplateShops;
