'use client';

import Link from 'next/link';
import { CldImage } from 'next-cloudinary';
import { useState } from 'react';
import './styling/templates.scss';
import Parallax from '@/components/layouts/parallax';
import { MdMonitor, MdPhoneIphone } from 'react-icons/md';

const TemplatesList = ({ templates }) => {
  const [hoveredCard, setHoveredCard] = useState(null);

  return (
    <div className="templatesContainer">
      <section className="others">
        <Parallax bgColor="#0c0c1d" title="Nos Modèles" planets="/sun.png" />
      </section>
      {templates.length !== undefined &&
        templates.map((template) => (
          <section key={template.template_id} className="others projectSection">
            <Link
              href={`/templates/${template.template_id}`}
              className="templateCard"
              style={{
                background: template.template_color,
              }}
              onMouseEnter={() => setHoveredCard(template.template_id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div
                className={`templateCardInner ${hoveredCard === template.template_id ? 'hovered' : ''}`}
              >
                {/* Conteneur image (70% de la hauteur) */}
                <div className="templateImageContainer">
                  <div className="templateAppImage">
                    <CldImage
                      src={template.template_image}
                      alt={`Interface de ${template.template_name}`}
                      width={1200}
                      height={800}
                      className="templateImage"
                      priority
                    />
                  </div>

                  {/* Gradients overlay */}
                  <div className="gradientOverlay"></div>
                  <div className="gradientLeft"></div>
                  <div className="gradientRight"></div>
                </div>

                {/* Conteneur info (30% de la hauteur) */}
                <div className="templateInfoContainer">
                  <div className="templateAppInfo">
                    <h3 className="templateName">{template.template_name}</h3>
                    <div className="templatePlatforms">
                      {template.template_has_web && (
                        <span className="templatePlatformIcon">
                          <MdMonitor size={20} />
                        </span>
                      )}
                      {template.template_has_mobile && (
                        <span className="templatePlatformIcon">
                          <MdPhoneIphone size={20} />
                        </span>
                      )}
                    </div>
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
