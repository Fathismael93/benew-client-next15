'use client';

import './appExamples.scss';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { MdArrowBackIos, MdArrowForwardIos } from 'react-icons/md';

// Données du portfolio à ajouter après les données des services
const portfolioItems = [
  {
    id: 1,
    image: '/buyitnow_1.png',
    description:
      'Notre plateforme e-commerce vous permet de créer facilement votre boutique en ligne avec tous les outils nécessaires pour réussir dans le commerce électronique.',
  },
  {
    id: 2,
    image: '/buyitnow_2.png',
    description:
      'Interface moderne et intuitive pour vos clients, avec des fonctionnalités avancées de paiement et de gestion des commandes intégrées.',
  },
];

const AppExamples = () => {
  // État pour le slider portfolio à ajouter avec les autres useState
  const [activePortfolioIndex, setActivePortfolioIndex] = useState(0);

  // Auto-play du slider portfolio à ajouter après l'auto-play des services
  useEffect(() => {
    const portfolioInterval = setInterval(() => {
      setActivePortfolioIndex((prev) => (prev + 1) % portfolioItems.length);
    }, 7000); // Change toutes les 4 secondes

    return () => clearInterval(portfolioInterval);
  }, [portfolioItems.length]);

  const goToPreviousPortfolioSlide = () => {
    setActivePortfolioIndex((prev) =>
      prev === 0 ? portfolioItems.length - 1 : prev - 1,
    );
  };

  const goToNextPortfolioSlide = () => {
    setActivePortfolioIndex((prev) => (prev + 1) % portfolioItems.length);
  };

  return (
    <div>
      {/* VERSION DESKTOP (≥ xl) - STRUCTURE OVERLAY */}
      <div className="portfolio-slider-desktop">
        <div className="portfolio-slider-container">
          {/* Items du slider desktop */}
          {portfolioItems.map((item, index) => (
            <div
              key={`desktop-${item.id}`}
              className={`portfolio-slide ${
                index === activePortfolioIndex ? 'active' : ''
              }`}
            >
              <Image
                src={item.image}
                alt={`Portfolio item ${item.id}`}
                fill
                className="slide-image"
                sizes="85vw"
                priority={index === 0}
              />

              <div className="slide-text-card">
                <p className="slide-description">{item.description}</p>
                <Link href="/boutique" className="portfolio-shop-link">
                  Visiter notre boutique
                </Link>
              </div>
            </div>
          ))}

          {/* Flèches desktop */}
          <button
            className="portfolio-nav-arrow prev"
            onClick={goToPreviousPortfolioSlide}
            aria-label="Slide précédent"
            type="button"
          >
            <MdArrowBackIos />
          </button>

          <button
            className="portfolio-nav-arrow next"
            onClick={goToNextPortfolioSlide}
            aria-label="Slide suivant"
            type="button"
          >
            <MdArrowForwardIos />
          </button>
        </div>
      </div>

      {/* VERSION MOBILE/TABLETTE (< xl) - STRUCTURE SÉPARÉE */}
      <div className="portfolio-slider-mobile">
        <div className="portfolio-slider-container">
          {/* Items du slider mobile */}
          {portfolioItems.map((item, index) => (
            <div
              key={`mobile-${item.id}`}
              className={`portfolio-slide ${
                index === activePortfolioIndex ? 'active' : ''
              }`}
            >
              {/* Section image - 60% de la hauteur */}
              <div className="mobile-image-section">
                <Image
                  src={item.image}
                  alt={`Portfolio item ${item.id}`}
                  fill
                  className="slide-image"
                  sizes="(max-width: 768px) 92vw, (max-width: 1024px) 88vw"
                  priority={index === 0}
                />
              </div>

              {/* Section texte - 40% de la hauteur */}
              <div className="mobile-text-section">
                <p className="slide-description">{item.description}</p>
                <Link href="/boutique" className="portfolio-shop-link">
                  Visiter notre boutique
                </Link>
              </div>
            </div>
          ))}

          {/* Flèches mobile */}
          <button
            className="portfolio-nav-arrow prev"
            onClick={goToPreviousPortfolioSlide}
            aria-label="Slide précédent"
            type="button"
          >
            <MdArrowBackIos />
          </button>

          <button
            className="portfolio-nav-arrow next"
            onClick={goToNextPortfolioSlide}
            aria-label="Slide suivant"
            type="button"
          >
            <MdArrowForwardIos />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppExamples;
