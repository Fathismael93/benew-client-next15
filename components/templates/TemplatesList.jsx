'use client';

import Link from 'next/link';
import { CldImage } from 'next-cloudinary';
import { useState, useEffect } from 'react';
import './styling/templates.scss';
import Parallax from '@/components/layouts/parallax';
import { MdMonitor, MdPhoneIphone, MdLaunch, MdCode } from 'react-icons/md';

// Imports analytics
import { trackTemplateView, trackPagePerformance } from '@/utils/analytics';

const TemplatesList = ({ templates, performanceMetrics }) => {
  const [hoveredCard, setHoveredCard] = useState(null);

  // Analytics tracking
  useEffect(() => {
    console.log('Performance Metrics:', performanceMetrics);
    if (performanceMetrics?.loadTime) {
      console.log('Tracking page performance:');
      trackPagePerformance(
        'templates_list',
        performanceMetrics.loadTime,
        performanceMetrics.fromCache,
      );
    }
  }, [performanceMetrics]);

  const handleTemplateClick = (template) => {
    trackTemplateView(template.template_id, template.template_name);
  };

  return (
    <div>
      <section className="first">
        <Parallax bgColor="#0c0c1d" title="Nos Modèles" planets="/sun.png" />
      </section>

      {templates.length !== undefined &&
        templates.map((template, index) => (
          <section key={template.template_id} className="others projectSection">
            <Link
              href={`/templates/${template.template_id}`}
              className="magazineCard"
              onMouseEnter={() => setHoveredCard(template.template_id)}
              onMouseLeave={() => setHoveredCard(null)}
              onClick={() => handleTemplateClick(template)}
            >
              <div
                className={`magazineCardInner ${
                  hoveredCard === template.template_id ? 'hovered' : ''
                }`}
              >
                {/* Image Background */}
                <div className="magazineImageBackground">
                  <CldImage
                    src={template.template_image}
                    alt={`Interface de ${template.template_name}`}
                    width={1400}
                    height={900}
                    className="magazineBackgroundImage"
                    priority={index < 2} // Priorité pour les 2 premières
                  />
                  {/* Overlay gradient */}
                  <div className="magazineOverlay" />
                </div>

                {/* Badges Plateformes - Position absolue */}
                <div className="magazinePlatformBadges">
                  {template.template_has_web && (
                    <div className="platformBadge web">
                      <MdMonitor size={18} />
                      <span>Web</span>
                    </div>
                  )}
                  {template.template_has_mobile && (
                    <div className="platformBadge mobile">
                      <MdPhoneIphone size={18} />
                      <span>Mobile</span>
                    </div>
                  )}
                </div>

                {/* Contenu Principal - Superposition */}
                <div className="magazineContent">
                  {/* Catégorie/Tag */}
                  <div className="magazineCategory">Template Premium</div>

                  {/* Titre Principal */}
                  <h2 className="magazineTitle">{template.template_name}</h2>

                  {/* Description (optionnelle) */}
                  <p className="magazineDescription">
                    Solution professionnelle avec design moderne et
                    fonctionnalités avancées
                  </p>

                  {/* Actions Rapides */}
                  <div className="magazineActions">
                    <div className="actionButton primary">
                      <MdLaunch size={16} />
                      <span>Voir Détails</span>
                    </div>
                    <div className="actionButton secondary">
                      <MdCode size={16} />
                      <span>Preview</span>
                    </div>
                  </div>
                </div>

                {/* Indicateur de progression (optionnel) */}
                <div className="magazineProgress">
                  <div className="progressDots">
                    {templates.map((_, i) => (
                      <div
                        key={i}
                        className={`progressDot ${i === index ? 'active' : ''}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          </section>
        ))}
    </div>
  );
};

export default TemplatesList;
