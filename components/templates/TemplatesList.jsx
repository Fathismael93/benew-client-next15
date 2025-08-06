'use client';

import Link from 'next/link';
import { CldImage } from 'next-cloudinary';
import { useState, useEffect } from 'react';
import './templatesStyles/index.scss'; // Importing the main styles for templates
import Parallax from '@/components/layouts/parallax';
import { MdMonitor, MdPhoneIphone } from 'react-icons/md';

// Imports analytics
import { trackTemplateView, trackPagePerformance } from '@/utils/analytics';

const TemplatesList = ({ templates, performanceMetrics }) => {
  const [hoveredCard, setHoveredCard] = useState(null);

  // Dans TemplatesList.jsx, ajoutez cet useEffect
  useEffect(() => {
    // Analytics tracking existant
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
              className="minimalCard"
              onMouseEnter={() => setHoveredCard(template.template_id)}
              onMouseLeave={() => setHoveredCard(null)}
              onClick={() => handleTemplateClick(template)}
            >
              <div
                className={`minimalCardInner ${
                  hoveredCard === template.template_id ? 'hovered' : ''
                }`}
              >
                {/* Image Container */}
                <div className="minimalImageContainer">
                  <CldImage
                    src={template.template_image}
                    alt={`Interface de ${template.template_name}`}
                    width={800}
                    height={600}
                    className="minimalImage"
                    priority={index < 2}
                  />
                </div>

                {/* Content Container */}
                <div className="minimalContent">
                  {/* Title */}
                  <h3 className="minimalTitle">{template.template_name}</h3>

                  {/* Category with Icon */}
                  <div className="minimalCategory">
                    {template.template_has_web &&
                    template.template_has_mobile ? (
                      <>
                        <MdMonitor size={14} />
                        <MdPhoneIphone size={14} />
                        <span>Web & Mobile</span>
                      </>
                    ) : template.template_has_web ? (
                      <>
                        <MdMonitor size={14} />
                        <span>Web App</span>
                      </>
                    ) : (
                      <>
                        <MdPhoneIphone size={14} />
                        <span>Mobile App</span>
                      </>
                    )}
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
