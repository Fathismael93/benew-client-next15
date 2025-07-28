'use client';

import './homePage.scss';
import PageTracker from 'components/analytics/PageTracker';
import Hero from 'components/layouts/hero';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { MdPalette, MdPayment, MdSecurity, MdVerified } from 'react-icons/md';

const HomeComponent = () => {
  // État pour le slider des services
  const [activeServiceIndex, setActiveServiceIndex] = useState(0);

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

  // Auto-play du slider
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveServiceIndex((prev) => (prev + 1) % services.length);
    }, 4000); // Change toutes les 4 secondes

    return () => clearInterval(interval);
  }, [services.length]);

  // Navigation du slider
  const goToService = (index) => {
    setActiveServiceIndex(index);
  };

  // Navigation clavier
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        setActiveServiceIndex((prev) =>
          prev === 0 ? services.length - 1 : prev - 1,
        );
      } else if (event.key === 'ArrowRight') {
        setActiveServiceIndex((prev) => (prev + 1) % services.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [services.length]);

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
        <h2 className="section-main-title">Une boutique :</h2>

        <div className="services-slider-container">
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

      <section className="others" data-section="portfolio_intro"></section>
      <section className="others" data-section="portfolio_showcase"></section>
      <section className="others" data-section="portfolio_showcase"></section>
    </div>
  );
};

export default HomeComponent;
