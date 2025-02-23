'use client';

import React from 'react';
// pages/portfolio.js
import Link from 'next/link';
import Image from 'next/image';
import './styling/templates.scss';
import Parallax from '@/components/layouts/parallax';

const TemplatesList = ({ templates }) => {
  const projects = [
    {
      id: 1,
      title: 'Transformation Digitale',
      image: '/e-commerce.jpg',
      link: '/templates/1',
    },
    {
      id: 2,
      title: 'Innovation Technologique',
      image: '/e-commerce2.jpg',
      link: '/templates/2',
    },
    {
      id: 3,
      title: 'Solutions Cloud',
      image: '/e-commerce3.jpg',
      link: '/templates/3',
    },
  ];

  console.log(templates);

  return (
    <div>
      <section className="others">
        <Parallax bgColor="#0c0c1d" title="Nos Modèles" planets="/sun.png" />
      </section>
      {templates.map((template) => (
        <section key={template.template_id} className="others projectSection">
          <div className="imageContainer">
            <Image
              src={template.template_image}
              alt={template.template_title}
              fill
              className="projectImage"
              priority
            />
          </div>
          <Link href="" className="titleLink">
            <h4 className="projectTitle">{template.template_title}</h4>
          </Link>
        </section>
      ))}
    </div>
  );
};

export default TemplatesList;
