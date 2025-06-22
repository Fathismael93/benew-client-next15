'use client';

import React from 'react';
import Link from 'next/link';
import { CldImage } from 'next-cloudinary';
import './styling/templates.scss';
import Parallax from '@/components/layouts/parallax';
import { MdMonitor, MdPhoneIphone } from 'react-icons/md';

const TemplatesList = ({ templates }) => {
  return (
    <div className="templatesContainer">
      <section className="others">
        <Parallax bgColor="#0c0c1d" title="Nos Modèles" planets="/sun.png" />
      </section>
      {templates.length !== undefined &&
        templates.map((template) => (
          <section key={template.template_id} className="others projectSection">
            <div className="contentCard">
              <div className="imageContainer">
                <CldImage
                  src={template.template_image}
                  alt={template.template_name}
                  width={1200}
                  height={800}
                  className="projectImage"
                  priority
                />
                <div className="platforms">
                  <span className="platformIcon">
                    <MdMonitor size={24} />
                  </span>
                  {template.template_has_mobile && (
                    <span className="platformIcon">
                      <MdPhoneIphone size={24} />
                    </span>
                  )}
                </div>
              </div>
              <Link
                href={`/templates/${template.template_id}`}
                className="titleLink"
              >
                <h4 className="projectTitle">{template.template_name}</h4>
                <span className="viewDetails">Voir les applications</span>
              </Link>
            </div>
          </section>
        ))}
    </div>
  );
};

export default TemplatesList;
