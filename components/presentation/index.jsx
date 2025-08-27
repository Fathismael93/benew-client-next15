'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import './index.scss';
import Image from 'next/image';
import { MdOutlineChevronLeft, MdOutlineChevronRight } from 'react-icons/md';

import ParallaxSkeleton from '../layouts/parallax/ParallaxSkeleton';
// Import dynamique des composants
const Parallax = dynamic(() => import('components/layouts/parallax'), {
  loading: () => <ParallaxSkeleton />,
  ssr: true,
});

import PresentationModal from 'components/modal/PresentationModal';
import PageTracker from '../analytics/PageTracker';
import { trackEvent } from '@/utils/analytics';

// Contenu pour chaque section
const contentData = {
  presentation: {
    title: 'Le Manifeste Benew',
    paragraphs: [
      "Chez Benew, nous croyons en l'innovation. Nous croyons que nous sommes capables de faire des choses fabuleuses pour notre pays. " +
        'Nous croyons en notre pouvoir a le revolutionner et en notre pouvoir a nous sublimer nous-memes. ' +
        'Nous croyons en notre potentiel a concurrencer les plus grandes nations de ce monde et nous croyons que nous avons ' +
        "des personnes fabuleuses avec des talents extraordinaires qui ne demandent qu'a s'exprimer parmi nous. " +
        'Nous avons la conviction que, dans ce monde en plein changement, nous devons etre des catalyseurs et non des attentistes, ' +
        'des producteurs et non des consommateurs, des pionniers et non des copieurs. ' +
        "C'est pourquoi nous nous sommes donnes comme mission premiere de proposer des solutions modernes, innovantes et utiles " +
        "et de montrer la voie vers l'excellence et l'amelioration continue.",
      'Chez Benew, nous croyons en vous. Croyez-vous en vous meme ?',
    ],
  },
  produit: {
    title: 'Nos Produits',
    paragraphs: [
      'Nos boutiques sont pensees et concues pour le djiboutien lambda. Elles integrent les systemes de paiement ' +
        'electroniques existants actuellement. Elles ont ete creees avec les dernieres technologies pour vous offrir ' +
        'des performances inegalees et avec les meilleures pratiques de securite au standard international. ' +
        'Elles ne sont pas cheres et chaque fonctionnalite a ete pensee pour simplifier votre quotidien ' +
        "et vous permettre d'atteindre vos objectifs plus facilement que jamais.",
    ],
  },
  fondateur: {
    title: 'Le Fondateur',
    paragraphs: [
      "Passionne de mathematique, de technologie, d'entrepreneuriat et de design, ancien etudiant de l'universite de Lille, " +
        'developpeur et footballeur a ses heures perdues et profondement patriote, je mets a votre disposition ' +
        'ma modeste contribution pour le developpement national.',
    ],
  },
};

const PresentationComponent = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0); // ← Ajouter cette ligne

  // Ajouter avant handleItemClick
  const cards = ['presentation', 'produit', 'fondateur'];

  const handleSlideNavigation = (direction) => {
    const newSlide =
      direction === 'next'
        ? (currentSlide + 1) % cards.length
        : (currentSlide - 1 + cards.length) % cards.length;

    // ⭐ TRACKING SLIDER NAVIGATION
    trackEvent('presentation_slider_nav', {
      event_category: 'presentation',
      event_label: direction,
      from_slide: cards[currentSlide],
      to_slide: cards[newSlide],
      slider_position: newSlide,
    });

    setCurrentSlide(newSlide);
  };

  const handleItemClick = (itemType) => {
    // ⭐ TRACKING MODAL OPEN
    trackEvent('presentation_modal_open', {
      event_category: 'presentation',
      event_label: itemType,
      modal_type: itemType,
      page_section: 'cards',
    });

    setModalContent(contentData[itemType]);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    // ⭐ TRACKING MODAL CLOSE
    if (modalContent) {
      trackEvent('presentation_modal_close', {
        event_category: 'presentation',
        event_label: cards.find((card) => contentData[card] === modalContent),
        modal_type: cards.find((card) => contentData[card] === modalContent),
      });
    }

    setIsModalOpen(false);
    setModalContent(null);
  };

  return (
    <>
      {/* ⭐ AJOUTER LE PAGETRACKER */}
      <PageTracker
        pageName="presentation"
        pageType="informational"
        sections={['hero_parallax', 'presentation_cards', 'modal_interactions']}
      />

      <section className="others">
        <Parallax bgColor="#0c0c1d" title="Presentation" planets="/sun.png" />
      </section>
      <section className="others">
        <div className="planets-background" />
        <div className="stars" />
        <div className="banner">
          <div className="cards-container">
            {/* Desktop - toutes les cartes visibles */}
            <div className="cards-desktop">
              <div
                className="card"
                onClick={() => handleItemClick('presentation')}
              >
                <h2>Présentation</h2>
                <Image
                  src="/images/the_announcer.png"
                  alt="Présentation"
                  width={150}
                  height={200}
                  className="card-image"
                />
              </div>
              <div className="card" onClick={() => handleItemClick('produit')}>
                <h2>Produit</h2>
                <Image
                  src="/images/the_product.png"
                  alt="Produit"
                  width={150}
                  height={200}
                  className="card-image"
                />
              </div>
              <div
                className="card"
                onClick={() => handleItemClick('fondateur')}
              >
                <h2>Fondateur</h2>
                <Image
                  src="/images/maitre_kaio.png"
                  alt="Fondateur"
                  width={150}
                  height={200}
                  className="card-image"
                />
              </div>
            </div>

            {/* Mobile - slider */}
            <div className="cards-mobile-slider">
              {/* Flèche gauche */}
              <button
                className="slider-arrow slider-arrow-left"
                onClick={() => handleSlideNavigation('prev')}
              >
                <MdOutlineChevronLeft size={24} />
              </button>

              {/* Carte active */}
              <div className="slider-card-container">
                {currentSlide === 0 && (
                  <div
                    className="card active"
                    onClick={() => handleItemClick('presentation')}
                  >
                    <h2>Présentation</h2>
                    <Image
                      src="/images/the_announcer.png"
                      alt="Présentation"
                      width={150}
                      height={200}
                      className="card-image"
                    />
                  </div>
                )}
                {currentSlide === 1 && (
                  <div
                    className="card active"
                    onClick={() => handleItemClick('produit')}
                  >
                    <h2>Produit</h2>
                    <Image
                      src="/images/the_product.png"
                      alt="Produit"
                      width={150}
                      height={200}
                      className="card-image"
                    />
                  </div>
                )}
                {currentSlide === 2 && (
                  <div
                    className="card active"
                    onClick={() => handleItemClick('fondateur')}
                  >
                    <h2>Fondateur</h2>
                    <Image
                      src="/images/maitre_kaio.png"
                      alt="Fondateur"
                      width={150}
                      height={200}
                      className="card-image"
                    />
                  </div>
                )}
              </div>

              {/* Flèche droite */}
              <button
                className="slider-arrow slider-arrow-right"
                onClick={() => handleSlideNavigation('next')}
              >
                <MdOutlineChevronRight size={24} />
              </button>

              {/* Indicateurs */}
              <div className="slider-indicators">
                {cards.map((_, index) => (
                  <button
                    key={index}
                    className={`indicator ${index === currentSlide ? 'active' : ''}`}
                    onClick={() => setCurrentSlide(index)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <PresentationModal
        isOpen={isModalOpen}
        onClose={closeModal}
        content={modalContent}
      />
    </>
  );
};

export default PresentationComponent;
