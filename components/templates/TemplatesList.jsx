'use client';

import Link from 'next/link';
import { CldImage } from 'next-cloudinary';
import { useState, useEffect, useCallback, memo } from 'react';
import { MdMonitor, MdPhoneIphone } from 'react-icons/md';
import './templatesStyles/index.scss';
import Parallax from '@/components/layouts/parallax';
import PageTracker from '../analytics/PageTracker';
import {
  trackTemplateView,
  trackPagePerformance,
  trackEvent,
} from '@/utils/analytics';

// Composant de carte mémorisé pour éviter les re-renders
const TemplateCard = memo(
  ({ template, index, isHovered, onHover, onLeave, onClick }) => {
    const templateType = getTemplateType(template);

    return (
      <Link
        href={`/templates/${template.template_id}`}
        className="minimalCard"
        onMouseEnter={() => onHover(template.template_id)}
        onMouseLeave={onLeave}
        onClick={() => onClick(template)}
        aria-label={`Voir le template ${template.template_name} - ${templateType}`}
      >
        <div className={`minimalCardInner ${isHovered ? 'hovered' : ''}`}>
          <div className="minimalImageContainer">
            <CldImage
              src={template.template_image}
              alt={`Template ${template.template_name} - ${templateType} pour applications web et mobile`}
              width={800}
              height={600}
              className="minimalImage"
              priority={index < 2}
              loading={index < 2 ? 'eager' : 'lazy'}
              placeholder="blur"
              blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..." // Générer un vrai blur
            />
          </div>
          <div className="minimalContent">
            <h3 className="minimalTitle">{template.template_name}</h3>
            <div className="minimalCategory">
              {renderCategoryIcons(template)}
              <span>{getCategoryLabel(template)}</span>
            </div>
          </div>
        </div>
      </Link>
    );
  },
);

TemplateCard.displayName = 'TemplateCard';

// Composant principal amélioré
const TemplatesList = ({
  templates = [],
  performanceMetrics = {},
  adaptiveConfig = {},
}) => {
  const [hoveredCard, setHoveredCard] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Validation des props
  useEffect(() => {
    if (!Array.isArray(templates)) {
      setError('Format de données invalide');
      console.error('Templates must be an array', templates);
    }
  }, [templates]);

  // Tracking de performance
  useEffect(() => {
    if (performanceMetrics?.loadTime) {
      trackPagePerformance(
        'templates_list',
        performanceMetrics.loadTime,
        performanceMetrics.fromCache,
      );
    }
  }, [performanceMetrics]);

  // Handlers optimisés avec useCallback
  const handleTemplateClick = useCallback(
    (template) => {
      trackTemplateView(template.template_id, template.template_name);
      trackEvent('template_card_click', {
        event_category: 'templates',
        event_label: template.template_name,
        template_id: template.template_id,
        template_type: getTemplateType(template),
        card_position:
          templates.findIndex((t) => t.template_id === template.template_id) +
          1,
        total_templates: templates.length,
      });
    },
    [templates],
  );

  const handleHover = useCallback((id) => {
    setHoveredCard(id);
  }, []);

  const handleLeave = useCallback(() => {
    setHoveredCard(null);
  }, []);

  // Gestion des erreurs
  if (error) {
    return (
      <div className="templates-error">
        <h2>Une erreur est survenue</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Réessayer</button>
      </div>
    );
  }

  // État vide
  if (!templates || templates.length === 0) {
    return (
      <div className="templates-empty">
        <PageTracker pageName="templates_list_empty" />
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

  return (
    <div className="templates-container">
      <PageTracker
        pageName="templates_list"
        pageType="catalog"
        sections={['hero_parallax', 'templates_grid', 'template_interactions']}
      />

      <section className="first">
        <Parallax bgColor="#0c0c1d" title="Nos Modèles" planets="/sun.png" />
      </section>

      <div className="templates-grid" role="list">
        {templates.map((template, index) => (
          <section
            key={template.template_id}
            className="others projectSection"
            role="listitem"
          >
            <TemplateCard
              template={template}
              index={index}
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

// Fonctions utilitaires
function getTemplateType(template) {
  if (template.template_has_web && template.template_has_mobile) {
    return 'web_and_mobile';
  } else if (template.template_has_web) {
    return 'web_only';
  } else {
    return 'mobile_only';
  }
}

function getCategoryLabel(template) {
  if (template.template_has_web && template.template_has_mobile) {
    return 'Web & Mobile';
  } else if (template.template_has_web) {
    return 'Web App';
  } else {
    return 'Mobile App';
  }
}

function renderCategoryIcons(template) {
  if (template.template_has_web && template.template_has_mobile) {
    return (
      <>
        <MdMonitor size={14} aria-hidden="true" />
        <MdPhoneIphone size={14} aria-hidden="true" />
      </>
    );
  } else if (template.template_has_web) {
    return <MdMonitor size={14} aria-hidden="true" />;
  } else {
    return <MdPhoneIphone size={14} aria-hidden="true" />;
  }
}

export default TemplatesList;
