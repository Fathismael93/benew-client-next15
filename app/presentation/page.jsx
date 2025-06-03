'use client';

import React, { useState } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import './presentation.scss';
import Parallax from '@/components/layouts/parallax';
import PresentationModal from '@/components/modal/PresentationModal';

function Presentation() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState(null);

  // Valeur pour contrôler la rotation avec le drag
  const rotationY = useMotionValue(0);

  // Contenu pour chaque section
  const contentData = {
    presentation: {
      title: 'Présentation',
      paragraphs: [
        'Bienvenue dans notre univers ! Nous sommes ravis de vous présenter notre projet innovant qui combine technologie de pointe et créativité.',
        'Notre approche unique nous permet de vous offrir une expérience exceptionnelle, alliant performance et design moderne pour répondre à tous vos besoins.',
      ],
    },
    produit: {
      title: 'Notre Produit',
      paragraphs: [
        'Découvrez notre produit révolutionnaire conçu avec les dernières technologies pour vous offrir une performance inégalée.',
        "Chaque fonctionnalité a été pensée pour simplifier votre quotidien et vous permettre d'atteindre vos objectifs plus facilement que jamais.",
      ],
    },
    fondateur: {
      title: 'Le Fondateur',
      paragraphs: [
        "Rencontrez notre fondateur visionnaire, passionné par l'innovation et déterminé à révolutionner votre façon de travailler.",
        "Avec plus de 10 ans d'expérience dans le domaine, il apporte son expertise et sa vision pour créer des solutions qui font la différence.",
      ],
    },
  };

  const handleItemClick = (itemType) => {
    setModalContent(contentData[itemType]);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalContent(null);
  };

  return (
    <div>
      <section className="others">
        <Parallax bgColor="#0c0c1d" title="Présentation" planets="/sun.png" />
      </section>
      <section className="others">
        <div
          className="planets"
          style={{
            backgroundImage: `url(/planets.png)`,
          }}
        />
        <div className="stars" />
        <div className="banner">
          <motion.div
            className="slider"
            style={{
              '--quantity': 3,
              rotateY: rotationY,
              rotateX: -26,
            }}
            // Animation de base qui continue
            animate={{
              rotateY: 360,
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'linear',
            }}
            // Contrôles de drag
            drag="x"
            dragConstraints={{ left: -200, right: 200 }}
            onDrag={(event, info) => {
              // Convertit le mouvement horizontal en rotation
              // Plus on va à droite, plus ça tourne dans le sens positif
              const dragRotation = info.offset.x * 0.5;
              rotationY.set(dragRotation);
            }}
            onDragEnd={() => {
              // Revient à l'animation normale après le drag
              rotationY.set(0);
            }}
            whileDrag={{
              cursor: 'grabbing',
            }}
          >
            <div
              className="item"
              style={{ '--position': 1 }}
              onClick={() => handleItemClick('presentation')}
            >
              <h2>Présentation</h2>
              <img src="/images/the_announcer.png" alt="Présentation" />
            </div>
            <div
              className="item"
              style={{ '--position': 2 }}
              onClick={() => handleItemClick('produit')}
            >
              <h2>Produit</h2>
              <img src="/images/the_product.png" alt="Produit" />
            </div>
            <div
              className="item"
              style={{ '--position': 3 }}
              onClick={() => handleItemClick('fondateur')}
            >
              <h2>Fondateur</h2>
              <img src="/images/maitre_kaio.png" alt="Fondateur" />
            </div>
          </motion.div>
        </div>
      </section>

      <PresentationModal
        isOpen={isModalOpen}
        onClose={closeModal}
        content={modalContent}
      />
    </div>
  );
}

export default Presentation;
