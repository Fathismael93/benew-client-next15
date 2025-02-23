'use client';

import React from 'react';
// pages/portfolio.js
import Link from 'next/link';
import Image from 'next/image';
import './templates.scss';
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
      {projects.map((project) => (
        <section key={project.id} className="others projectSection">
          <div className="imageContainer">
            <Image
              src={project.image}
              alt={project.title}
              fill
              className="projectImage"
              priority
            />
          </div>
          <Link href={project.link} className="titleLink">
            <h4 className="projectTitle">{project.title}</h4>
          </Link>
        </section>
      ))}
    </div>
  );
};

export default TemplatesList;
