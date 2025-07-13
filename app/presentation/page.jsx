'use client';

import { useState, useRef } from 'react';
import { motion, useMotionValue, useSpring, useAnimation } from 'framer-motion';
import Image from 'next/image';
import './presentation.scss';
import Parallax from '@/components/layouts/parallax';
import PresentationModal from '@/components/modal/PresentationModal';

function Presentation() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(true);

  // Contrôles pour l'animation avancée
  const controls = useAnimation();
  const rotationY = useMotionValue(0);
  const springRotation = useSpring(rotationY, {
    stiffness: 300,
    damping: 30,
  });

  const baseRotationRef = useRef(0); // Rotation de base de l'animation auto
  const userRotationRef = useRef(0); // Rotation ajoutée par l'utilisateur

  const itemAngle = 120; // 360 / 3 items

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

  // Fonction pour trouver l'item le plus proche
  const snapToNearestItem = (currentRotation) => {
    const normalizedRotation = ((currentRotation % 360) + 360) % 360;
    const nearestItemIndex = Math.round(normalizedRotation / itemAngle) % 3;
    return nearestItemIndex * itemAngle;
  };

  // Fonction pour mettre à jour l'index actuel
  const updateCurrentIndex = (rotation) => {
    const normalizedRotation = ((rotation % 360) + 360) % 360;
    const newIndex = Math.round(normalizedRotation / itemAngle) % 3;
    setCurrentIndex(newIndex);
  };

  const handleItemClick = (itemType) => {
    setModalContent(contentData[itemType]);
    setIsModalOpen(true);
    setIsAutoRotating(false); // Pause l'auto-rotation quand modal ouverte
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalContent(null);
    setIsAutoRotating(true); // Reprend l'auto-rotation
  };

  return (
    <div>
      <section className="others">
        <Parallax bgColor="#0c0c1d" title="Présentation" planets="/sun.png" />
      </section>
      <section className="others">
        <div className="planets-background" />
        <div className="stars" />
        <div className="banner">
          <motion.div
            className="slider"
            data-quantity={3}
            style={{
              rotateY: springRotation,
              rotateX: -26,
            }}
            // Animation de base qui continue
            animate={
              isAutoRotating
                ? {
                    rotateY: [
                      baseRotationRef.current,
                      baseRotationRef.current + 360,
                    ],
                  }
                : controls
            } // Un seul animate qui change selon l'état ✅
            transition={{
              duration: 20,
              repeat: isAutoRotating ? Infinity : 0,
              ease: 'linear',
            }}
            onUpdate={(latest) => {
              if (isAutoRotating && latest.rotateY !== undefined) {
                baseRotationRef.current = latest.rotateY;
                const totalRotation = latest.rotateY + userRotationRef.current;
                rotationY.set(totalRotation);
                updateCurrentIndex(totalRotation);
              }
            }}
            // Contrôles de drag avancés
            drag="x"
            dragConstraints={{ left: -300, right: 300 }}
            dragElastic={0.1}
            onDragStart={() => {
              setIsAutoRotating(false); // Arrête l'auto-rotation pendant le drag
            }}
            onDrag={(event, info) => {
              // Sensibilité adaptée pour un contrôle plus précis
              const dragRotation = info.offset.x * 0.3;
              userRotationRef.current = dragRotation;
              const totalRotation = baseRotationRef.current + dragRotation;
              rotationY.set(totalRotation);
              updateCurrentIndex(totalRotation);
            }}
            onDragEnd={(event, info) => {
              const velocity = info.velocity.x;
              const currentRotation =
                baseRotationRef.current + userRotationRef.current;

              // Calcul de l'inertie basée sur la vélocité
              const inertiaFactor = 0.05;
              const inertiaRotation = velocity * inertiaFactor;
              const finalRotation = currentRotation + inertiaRotation;

              // Snap vers l'item le plus proche
              const snappedRotation = snapToNearestItem(finalRotation);

              // Animation fluide vers la position finale
              controls
                .start({
                  rotateY: snappedRotation,
                  transition: {
                    type: 'spring',
                    stiffness: 300,
                    damping: 30,
                    mass: 0.8,
                  },
                })
                .then(() => {
                  // Met à jour les références après l'animation
                  baseRotationRef.current = snappedRotation;
                  userRotationRef.current = 0;
                  updateCurrentIndex(snappedRotation);

                  // Reprend l'auto-rotation après un délai
                  setTimeout(() => {
                    setIsAutoRotating(true);
                  }, 2000);
                });
            }}
            whileDrag={{
              cursor: 'grabbing',
              scale: 1.02,
              rotateX: -30,
            }}
          >
            <div
              className={`item ${currentIndex === 0 ? 'active' : ''} item-position-1`}
              onClick={() => handleItemClick('presentation')}
            >
              <h2>Présentation</h2>
              <Image
                src="/images/the_announcer.png"
                alt="Présentation"
                width={150}
                height={200}
                className="item-image"
              />
            </div>
            <div
              className={`item ${currentIndex === 1 ? 'active' : ''} item-position-2`}
              onClick={() => handleItemClick('produit')}
            >
              <h2>Produit</h2>
              <Image
                src="/images/the_product.png"
                alt="Produit"
                width={150}
                height={200}
                className="item-image"
              />
            </div>
            <div
              className={`item ${currentIndex === 2 ? 'active' : ''} item-position-3`}
              onClick={() => handleItemClick('fondateur')}
            >
              <h2>Fondateur</h2>
              <Image
                src="/images/maitre_kaio.png"
                alt="Fondateur"
                width={150}
                height={200}
                className="item-image"
              />
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
