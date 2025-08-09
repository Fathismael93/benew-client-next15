// components/templates/TemplatesList.jsx
'use client';

import Link from 'next/link';
import { CldImage } from 'next-cloudinary';
import { useState, useEffect, memo, useCallback } from 'react';
import { MdMonitor, MdPhoneIphone } from 'react-icons/md';
import './templatesStyles/index.scss';
import Parallax from '@/components/layouts/parallax';
import { trackEvent } from '@/utils/analytics';

// Composant de carte mémorisé pour performance
const TemplateCard = memo(
  ({ template, isHovered, onHover, onLeave, onClick }) => {
    const categoryIcons = [];
    const categoryLabel = [];

    // Déterminer les icônes et labels
    if (template.template_has_web) {
      categoryIcons.push(<MdMonitor key="web" size={14} aria-hidden="true" />);
      categoryLabel.push('Web');
    }
    if (template.template_has_mobile) {
      categoryIcons.push(
        <MdPhoneIphone key="mobile" size={14} aria-hidden="true" />,
      );
      categoryLabel.push('Mobile');
    }

    return (
      <Link
        href={`/templates/${template.template_id}`}
        className="minimalCard"
        onMouseEnter={() => onHover(template.template_id)}
        onMouseLeave={onLeave}
        onClick={() => onClick(template)}
        aria-label={`Voir le template ${template.template_name}`}
      >
        <div className={`minimalCardInner ${isHovered ? 'hovered' : ''}`}>
          <div className="minimalImageContainer">
            <CldImage
              src={template.template_image}
              alt={`Template ${template.template_name}`}
              width={800}
              height={600}
              className="minimalImage"
              loading="lazy"
              quality="auto"
              format="auto"
              crop={{ type: 'fill', gravity: 'auto', source: true }}
            />
          </div>
          <div className="minimalContent">
            <h3 className="minimalTitle">{template.template_name}</h3>
            <div className="minimalCategory">
              {categoryIcons}
              <span>{categoryLabel.join(' & ')}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  },
);

TemplateCard.displayName = 'TemplateCard';

// Composant principal simplifié
const TemplatesList = ({ templates = [] }) => {
  const [hoveredCard, setHoveredCard] = useState(null);
  const [viewedTemplates, setViewedTemplates] = useState(new Set());

  // Tracking de la page view (une seule fois)
  useEffect(() => {
    if (templates.length > 0) {
      trackEvent('page_view', {
        event_category: 'templates',
        event_label: 'templates_list',
        templates_count: templates.length,
      });
    }
  }, []); // Dépendance vide intentionnelle pour une seule exécution

  // Handler pour le clic sur un template
  const handleTemplateClick = useCallback(
    (template) => {
      // Tracker seulement si pas déjà vu dans cette session
      if (!viewedTemplates.has(template.template_id)) {
        trackEvent('template_click', {
          event_category: 'ecommerce',
          event_label: template.template_name,
          template_id: template.template_id,
          template_name: template.template_name,
        });

        setViewedTemplates((prev) => new Set([...prev, template.template_id]));
      }
    },
    [viewedTemplates],
  );

  // Handlers simples pour le hover
  const handleHover = useCallback((id) => setHoveredCard(id), []);
  const handleLeave = useCallback(() => setHoveredCard(null), []);

  // Gestion des états vides
  if (!templates || templates.length === 0) {
    return (
      <div className="templates-empty">
        <section className="first">
          <Parallax bgColor="#0c0c1d" title="Nos Modèles" planets="/sun.png" />
        </section>
        <section className="empty-state">
          <h2>Aucun template disponible</h2>
          <p>Revenez bientôt pour découvrir nos nouveaux templates</p>
          <Link href="/" className="cta-button">
            Retour à l&apos;accueil
          </Link>
        </section>
      </div>
    );
  }

  // Rendu principal
  return (
    <div className="templates-container">
      <section className="first">
        <Parallax bgColor="#0c0c1d" title="Nos Modèles" planets="/sun.png" />
      </section>

      <div className="templates-grid" role="list">
        {templates.map((template) => (
          <section
            key={template.template_id}
            className="others projectSection"
            role="listitem"
          >
            <TemplateCard
              template={template}
              isHovered={hoveredCard === template.template_id}
              onHover={handleHover}
              onLeave={handleLeave}
              onClick={handleTemplateClick}
            />
          </section>
        ))}
      </div>
    </div>
  );
};

export default TemplatesList;
