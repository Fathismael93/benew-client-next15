'use client';

import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useAnimation } from 'framer-motion';
import './presentation.scss';
import Parallax from '@/components/layouts/parallax';
import PresentationModal from '@/components/modal/PresentationModal';

function Presentation() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const controls = useAnimation();
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

  const items = [
    {
      key: 'presentation',
      title: 'Présentation',
      image: '/images/the_announcer.png',
    },
    { key: 'produit', title: 'Produit', image: '/images/the_product.png' },
    { key: 'fondateur', title: 'Fondateur', image: '/images/maitre_kaio.png' },
  ];

  // Auto-rotation
  useEffect(() => {
    if (!isAutoPlay || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % items.length);
    }, 4000); // Change d'item toutes les 4 secondes

    return () => clearInterval(interval);
  }, [isAutoPlay, isPaused, items.length]);

  // Animation du carrousel
  useEffect(() => {
    const targetRotation = currentIndex * -120; // -120° pour chaque item

    controls.start({
      rotateY: targetRotation,
      transition: {
        duration: 0.8,
        ease: 'easeInOut',
      },
    });
  }, [currentIndex, controls]);

  const handleItemClick = (itemKey) => {
    setModalContent(contentData[itemKey]);
    setIsModalOpen(true);
    setIsPaused(true); // Pause l'animation quand modal ouvert
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalContent(null);
    setIsPaused(false); // Reprend l'animation
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
    setIsAutoPlay(false); // Arrête l'auto-play lors d'interaction manuelle
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
    setIsAutoPlay(false);
  };

  const goToItem = (index) => {
    setCurrentIndex(index);
    setIsAutoPlay(false);
  };

  const toggleAutoPlay = () => {
    setIsAutoPlay(!isAutoPlay);
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
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
          {/* Contrôles */}
          <div className="controls">
            <button
              className="control-btn prev-btn"
              onClick={goToPrev}
              aria-label="Précédent"
            >
              ‹
            </button>

            <button
              className="control-btn next-btn"
              onClick={goToNext}
              aria-label="Suivant"
            >
              ›
            </button>

            <button
              className="control-btn play-pause-btn"
              onClick={toggleAutoPlay}
              aria-label={
                isAutoPlay ? 'Arrêter auto-play' : 'Démarrer auto-play'
              }
            >
              {isAutoPlay ? '⏸' : '▶'}
            </button>

            <button
              className="control-btn pause-btn"
              onClick={togglePause}
              aria-label={isPaused ? 'Reprendre' : 'Pause'}
            >
              {isPaused ? '▶' : '⏸'}
            </button>
          </div>

          {/* Indicateurs */}
          <div className="indicators">
            {items.map((_, index) => (
              <button
                key={index}
                className={`indicator ${index === currentIndex ? 'active' : ''}`}
                onClick={() => goToItem(index)}
                aria-label={`Aller à l'item ${index + 1}`}
              />
            ))}
          </div>

          {/* Carrousel 3D */}
          <motion.div
            className="slider"
            animate={controls}
            style={{
              '--quantity': items.length,
              perspective: 1000,
              transformStyle: 'preserve-3d',
              rotateX: -26,
            }}
          >
            {items.map((item, index) => (
              <motion.div
                key={item.key}
                className="item"
                style={{
                  '--position': index + 1,
                }}
                onClick={() => handleItemClick(item.key)}
                whileHover={{
                  scale: 1.05,
                  transition: { duration: 0.2 },
                }}
                whileTap={{
                  scale: 0.95,
                  transition: { duration: 0.1 },
                }}
              >
                <motion.h2
                  animate={{
                    color: index === currentIndex ? '#ff6b6b' : '#ffffff',
                  }}
                  transition={{ duration: 0.3 }}
                >
                  {item.title}
                </motion.h2>
                <motion.img
                  src={item.image}
                  alt={item.title}
                  animate={{
                    borderColor:
                      index === currentIndex ? '#ff6b6b' : 'transparent',
                    boxShadow:
                      index === currentIndex
                        ? '0 0 20px rgba(255, 107, 107, 0.6)'
                        : '0 0 0px rgba(255, 107, 107, 0)',
                  }}
                  transition={{ duration: 0.3 }}
                />
              </motion.div>
            ))}
          </motion.div>

          {/* Informations sur l'item actuel */}
          <motion.div
            className="current-item-info"
            key={currentIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h3>{items[currentIndex].title}</h3>
            <p>Cliquez pour en savoir plus</p>
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
