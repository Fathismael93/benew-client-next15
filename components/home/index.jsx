'use client';

import './homePage.scss';
import PageTracker from 'components/analytics/PageTracker';
import Hero from 'components/layouts/hero';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  MdArrowBackIos,
  MdArrowForwardIos,
  MdPalette,
  MdPayment,
  MdSecurity,
  MdVerified,
} from 'react-icons/md';

// Données des services
const services = [
  {
    icon: MdPalette,
    label: 'Personnalisable',
    color: 'orange',
  },
  {
    icon: MdPayment,
    label: 'Avec les paiements electroniques intégrés',
    color: 'pink',
  },
  {
    icon: MdSecurity,
    label: 'Rapide et sécurisée',
    color: 'purple',
  },
  {
    icon: MdVerified,
    label: 'Créée avec les meilleurs pratiques des standards internationaux',
    color: 'light-pink',
  },
];

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

const HomeComponent = () => {
  // État pour le slider des services
  const [activeServiceIndex, setActiveServiceIndex] = useState(0);
  // État pour le slider portfolio à ajouter avec les autres useState
  const [activePortfolioIndex, setActivePortfolioIndex] = useState(0);

  // Auto-play du slider
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveServiceIndex((prev) => (prev + 1) % services.length);
    }, 4000); // Change toutes les 4 secondes

    return () => clearInterval(interval);
  }, [services.length]);

  // Auto-play du slider portfolio à ajouter après l'auto-play des services
  useEffect(() => {
    const portfolioInterval = setInterval(() => {
      setActivePortfolioIndex((prev) => (prev + 1) % portfolioItems.length);
    }, 4000); // Change toutes les 4 secondes

    return () => clearInterval(portfolioInterval);
  }, [portfolioItems.length]);

  // Navigation clavier pour le portfolio à ajouter dans le useEffect existant
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Navigation services (existant)
      if (event.key === 'ArrowLeft') {
        setActiveServiceIndex((prev) =>
          prev === 0 ? services.length - 1 : prev - 1,
        );
        // Navigation portfolio
        setActivePortfolioIndex((prev) =>
          prev === 0 ? portfolioItems.length - 1 : prev - 1,
        );
      } else if (event.key === 'ArrowRight') {
        setActiveServiceIndex((prev) => (prev + 1) % services.length);
        // Navigation portfolio
        setActivePortfolioIndex((prev) => (prev + 1) % portfolioItems.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [services.length, portfolioItems.length]);

  // Navigation du slider
  const goToService = (index) => {
    setActiveServiceIndex(index);
  };

  const goToPreviousPortfolioSlide = () => {
    setActivePortfolioIndex((prev) =>
      prev === 0 ? portfolioItems.length - 1 : prev - 1,
    );
  };

  const goToNextPortfolioSlide = () => {
    setActivePortfolioIndex((prev) => (prev + 1) % portfolioItems.length);
  };

  return (
    <div className="home-container">
      {/* Tracking spécifique à la page d'accueil */}
      <PageTracker
        pageName="home"
        pageType="landing"
        sections={[
          'hero',
          'products_intro',
          'services',
          'portfolio_intro',
          'portfolio_showcase',
          'contact_teaser',
        ]}
      />
      <section className="first" data-section="hero">
        <Hero />
      </section>
      <section
        className="others products-intro-section"
        data-section="products_intro"
      >
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
          </div>
        </div>
      </section>
      <section className="others services-section" data-section="services">
        {/* BLOC 1 : TITRE SEUL */}
        <div className="services-title-block">
          <h2 className="section-main-title">Une boutique :</h2>
        </div>

        {/* BLOC 2 : CARTES SEULES - CENTRAGE PARFAIT */}
        <div className="services-cards-block">
          <div className="service-card-container">
            {services.map((service, index) => {
              const IconComponent = service.icon;
              return (
                <div
                  key={index}
                  className={`service-card ${
                    index === activeServiceIndex ? 'active' : ''
                  } color-${service.color}`}
                >
                  <IconComponent className="service-icon" />
                  <div className="service-label">{service.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BLOC 3 : DOTS SEULS - EN BAS */}
        <div className="services-dots-block">
          <div className="slider-dots">
            {services.map((_, index) => (
              <button
                key={index}
                className={`dot ${index === activeServiceIndex ? 'active' : ''} color-${services[activeServiceIndex].color}`}
                onClick={() => goToService(index)}
                aria-label={`Aller au service ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section
        className="others portfolio-intro-section"
        data-section="portfolio_intro"
      >
        <div className="main-content">
          {/* TEXTE À GAUCHE sur desktop */}
          <div className="text-container">
            <p className="portfolio-text">
              Notre offre est concue pour votre reussite. Vous avez 75% des
              charges obligatoires et necessaires qui sont exonérées.
            </p>
          </div>

          {/* IMAGE À DROITE sur desktop */}
          <Image
            src="/success_1.png"
            alt="Illustration du succès et des réalisations"
            width={1536}
            height={1024}
            className="success-image"
            priority={false}
          />
        </div>
      </section>

      <section
        className="others portfolio-showcase-section"
        data-section="portfolio_showcase"
      >
        <div className="portfolio-slider-container">
          {/* Items du slider */}
          {portfolioItems.map((item, index) => (
            <div
              key={item.id}
              className={`portfolio-slide ${
                index === activePortfolioIndex ? 'active' : ''
              }`}
            >
              <Image
                src={item.image}
                alt={`Portfolio item ${item.id}`}
                fill
                className="slide-image"
                sizes="(max-width: 768px) 92vw, (max-width: 1024px) 88vw, 85vw"
                priority={index === 0} // Priority pour la première image seulement
              />

              <div className="slide-text-card">
                <p className="slide-description">{item.description}</p>
              </div>
            </div>
          ))}

          {/* Flèche précédente */}
          <button
            className="portfolio-nav-arrow prev"
            onClick={goToPreviousPortfolioSlide}
            aria-label="Slide précédent"
            type="button"
          >
            <MdArrowBackIos />
          </button>

          {/* Flèche suivante */}
          <button
            className="portfolio-nav-arrow next"
            onClick={goToNextPortfolioSlide}
            aria-label="Slide suivant"
            type="button"
          >
            <MdArrowForwardIos />
          </button>
        </div>
      </section>

      <section className="others" data-section="portfolio_showcase"></section>
    </div>
  );
};

export default HomeComponent;
