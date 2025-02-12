'use client';

import React, { useState } from 'react';
import ProductCard from '@/components/ProductCard';
import OrderModal from '@/components/OrderModal';
import './templateShops.scss';

const TemplateShops = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const products = [
    {
      id: 1,
      image: '/product1.jpg',
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
          <ProductCard
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
