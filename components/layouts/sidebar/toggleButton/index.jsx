'use client';

import { motion } from 'framer-motion';
import { useCallback } from 'react';

// Variants pour les lignes du hamburger
const topLineVariants = {
  closed: {
    d: 'M 2 2.5 L 20 2.5',
    transition: { duration: 0.3, ease: 'easeInOut' },
  },
  open: {
    d: 'M 3 16.5 L 17 2.5',
    transition: { duration: 0.3, ease: 'easeInOut' },
  },
};

const middleLineVariants = {
  closed: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  open: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

const bottomLineVariants = {
  closed: {
    d: 'M 2 16.346 L 20 16.346',
    transition: { duration: 0.3, ease: 'easeInOut' },
  },
  open: {
    d: 'M 3 2.5 L 17 16.346',
    transition: { duration: 0.3, ease: 'easeInOut' },
  },
};

// Variants pour le bouton
const buttonVariants = {
  closed: {
    rotate: 0,
    scale: 1,
  },
  open: {
    rotate: 180,
    scale: 1.05,
  },
};

function ToggleButton({ setOpen, isOpen, onClick }) {
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    } else {
      setOpen((prev) => !prev);
    }
  }, [onClick, setOpen]);

  const handleKeyDown = useCallback(
    (event) => {
      // Support clavier : Enter et Space
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  return (
    <motion.button
      className={`toggle-button ${isOpen ? 'active' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      variants={buttonVariants}
      animate={isOpen ? 'open' : 'closed'}
      whileHover={{
        scale: 1.1,
        transition: {
          type: 'spring',
          stiffness: 400,
          damping: 10,
        },
      }}
      whileTap={{
        scale: 1.05,
        transition: {
          type: 'spring',
          stiffness: 600,
          damping: 15,
        },
      }}
      whileFocus={{
        scale: 1.05,
        boxShadow: '0 0 0 3px rgba(255, 107, 53, 0.3)',
      }}
      aria-label={isOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
      aria-expanded={isOpen}
      aria-controls="sidebar-navigation"
      type="button"
    >
      {/* SVG animé pour l'icône hamburger */}
      <motion.svg
        width="23"
        height="23"
        viewBox="0 0 23 23"
        fill="none"
        aria-hidden="true"
        animate={isOpen ? 'open' : 'closed'}
      >
        {/* Ligne du haut */}
        <motion.path
          strokeWidth="2.5"
          stroke="currentColor"
          strokeLinecap="round"
          variants={topLineVariants}
          custom={isOpen}
        />

        {/* Ligne du milieu */}
        <motion.path
          strokeWidth="2.5"
          stroke="currentColor"
          strokeLinecap="round"
          d="M 2 9.423 L 20 9.423"
          variants={middleLineVariants}
          custom={isOpen}
        />

        {/* Ligne du bas */}
        <motion.path
          strokeWidth="2.5"
          stroke="currentColor"
          strokeLinecap="round"
          variants={bottomLineVariants}
          custom={isOpen}
        />
      </motion.svg>

      {/* Effet de brillance animé */}
      <motion.div
        className="button-shine"
        initial={{ x: '-100%', opacity: 0 }}
        animate={
          isOpen
            ? {
                x: '100%',
                opacity: [0, 1, 0],
                transition: {
                  duration: 0.6,
                  ease: 'easeInOut',
                  times: [0, 0.5, 1],
                },
              }
            : { x: '-100%', opacity: 0 }
        }
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      />

      {/* Indicateur d'état pour les lecteurs d'écran */}
      <span className="sr-only">{isOpen ? 'Menu ouvert' : 'Menu fermé'}</span>
    </motion.button>
  );
}

export default ToggleButton;
