'use client';

import './index.scss';
import { useEffect, useState } from 'react';
import { MdPalette, MdPayment, MdSecurity, MdVerified } from 'react-icons/md';

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

const QualitiesHome = () => {
  // État pour le slider des services
  const [activeServiceIndex, setActiveServiceIndex] = useState(0);

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

  return (
    <>
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
    </>
  );
};

export default QualitiesHome;
