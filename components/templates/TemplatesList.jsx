/* eslint-disable no-unused-vars */
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

// Composant Skeleton Loader
const TemplatesListSkeleton = () => {
  return (
    <div className="templates-skeleton">
      <section className="first">
        <Parallax bgColor="#0c0c1d" title="Nos Modèles" planets="/sun.png" />
      </section>
      <div className="templates-grid">
        {[...Array(6)].map((_, index) => (
          <section key={index} className="others projectSection">
            <div className="skeleton-card">
              <div className="skeleton-image"></div>
              <div className="skeleton-content">
                <div className="skeleton-title"></div>
                <div className="skeleton-category"></div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

// Fonction de génération du blur placeholder
const generateBlurDataURL = (dominantColor = '#0c0c1d') => {
  return `data:image/svg+xml;base64,${btoa(
    `<svg width="10" height="10" xmlns="http://www.w3.org/2000/svg">
     <rect width="10" height="10" fill="${dominantColor}"/>
   </svg>`,
  )}`;
};

// Composant de carte mémorisé pour éviter les re-renders
const TemplateCard = memo(
  ({
    template,
    index,
    isHovered,
    onHover,
    onLeave,
    onClick,
    onTouchStart,
    onTouchEnd,
  }) => {
    const templateType = getTemplateType(template);

    return (
      <Link
        href={`/templates/${template.template_id}`}
        className="minimalCard"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick(template);
          }
        }}
        tabIndex={0}
        onMouseEnter={() => onHover(template.template_id)}
        onMouseLeave={onLeave}
        onTouchStart={() => onTouchStart(template.template_id)}
        onTouchEnd={onTouchEnd}
        onClick={() => onClick(template)}
        aria-label={`Voir le template ${template.template_name} - ${templateType}`}
      >
        <div className={`minimalCardInner ${isHovered ? 'hovered' : ''}`}>
          <div className="minimalImageContainer">
            <CldImage
              src={template.template_image}
              alt={`Template ${template.template_name} - ${templateType}`}
              width={800}
              height={600}
              className="minimalImage"
              priority={index < 2}
              loading={index < 2 ? 'eager' : 'lazy'}
              placeholder="blur"
              blurDataURL={generateBlurDataURL()}
              crop={{ type: 'fill', gravity: 'auto', source: true }}
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
  const [isLoading, setIsLoading] = useState(true); // Commence par true
  const [error, setError] = useState(null);

  // Gestion correcte du loading state
  useEffect(() => {
    // Si templates est undefined, on est en train de charger
    if (templates === undefined && !error) {
      setIsLoading(true);
    }
    // Si templates est défini (même tableau vide) ou si erreur, on n'est plus en loading
    else {
      setIsLoading(false);
    }
  }, [templates, error]);

  // Validation des props
  useEffect(() => {
    if (templates !== undefined && !Array.isArray(templates)) {
      setError('Format de données invalide');
      console.error('Templates must be an array', templates);
      setIsLoading(false);
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

  // Tracking Web Vitals avec cleanup amélioré
  useEffect(() => {
    // Mesurer Largest Contentful Paint
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      let observer = null;

      try {
        observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];

          if (lastEntry) {
            trackEvent('web_vitals', {
              metric_name: 'LCP',
              value: lastEntry.renderTime || lastEntry.loadTime,
              page: 'templates_list',
            });
          }
        });

        observer.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        // Silently fail for unsupported browsers
        console.debug('PerformanceObserver not supported:', e);
      }

      // Cleanup function
      return () => {
        if (observer) {
          try {
            observer.disconnect();
          } catch (e) {
            // Silently fail cleanup
          }
        }
      };
    }
  }, []);

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

  // Touch handlers correctement implémentés
  const handleTouchStart = useCallback((id) => {
    // Vérifier si c'est vraiment un device tactile et non juste un navigateur qui supporte touch
    if (
      'ontouchstart' in window &&
      window.matchMedia('(pointer: coarse)').matches
    ) {
      setHoveredCard(id);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    // Vérifier si c'est vraiment un device tactile
    if (
      'ontouchstart' in window &&
      window.matchMedia('(pointer: coarse)').matches
    ) {
      // Petit délai pour permettre de voir l'effet hover avant de le retirer
      setTimeout(() => setHoveredCard(null), 150);
    }
  }, []);

  // Afficher le skeleton loader pendant le chargement
  if (isLoading && templates === undefined) {
    return <TemplatesListSkeleton />;
  }

  // Gestion des erreurs
  if (error) {
    return (
      <div className="templates-error">
        <h2>Une erreur est survenue</h2>
        <p>{error}</p>
        <button
          onClick={() => window.location.reload()}
          aria-label="Recharger la page"
        >
          Réessayer
        </button>
      </div>
    );
  }

  // État vide
  if (!isLoading && (!templates || templates.length === 0)) {
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

  // Rendu normal avec templates
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
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
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
