'use client';

import './index.scss';
import Image from 'next/image';
// import Link from 'next/link';

const MarketingHome = () => {
  const handleBlogClick = () => {
    window.location.href = '/blog';
  };

  return (
    <div className="main-content">
      <Image
        src="/tirelire.png"
        alt="Tirelire symbolisant l'économie et les profits"
        width={256}
        height={384}
        className="profit-image"
        priority
      />

      <div className="text-container">
        <h2 className="main-title">GÉNÈRES PLUS DE PROFIT,</h2>
        <h2 className="main-title">PAIES MOINS DE CHARGES</h2>

        {/* AJOUTER CE BOUTON ICI */}
        <button onClick={handleBlogClick} className="profit-blog-link">
          En savoir plus
        </button>
      </div>
    </div>
  );
};

export default MarketingHome;
