import React from 'react';

// pages/portfolio.js
import Link from 'next/link';
import Image from 'next/image';
import './products.scss';

const ProductsPage = () => {
  const projects = [
    {
      id: 1,
      title: 'Transformation Digitale',
      image: '/e-commerce.jpg',
      link: '/projects/digital-transformation',
    },
    {
      id: 2,
      title: 'Innovation Technologique',
      image: '/e-commerce2.jpg',
      link: '/projects/tech-innovation',
    },
    {
      id: 3,
      title: 'Solutions Cloud',
      image: '/e-commerce3.jpg',
      link: '/projects/cloud-solutions',
    },
  ];

  return (
    <div>
      <section className="others">
        <Parallax bgColor="#0c0c1d" title="Nos Produits" planets="/sun.png" />
      </section>
      {projects.map((project) => (
        <section key={project.id} className="others">
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
            <h2 className="projectTitle">{project.title}</h2>
          </Link>
        </section>
      ))}
    </div>
  );
};

export default ProductsPage;
