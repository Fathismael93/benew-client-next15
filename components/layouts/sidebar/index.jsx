'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Links from './links';
import ToggleButton from './toggleButton';
import './sidebar.scss';

// Variants d'animation optimisés
const sidebarVariants = {
  open: {
    clipPath: 'circle(1200px at 50px 50px)',
    transition: {
      type: 'spring',
      stiffness: 20,
      restDelta: 2,
    },
  },
  closed: {
    clipPath: 'circle(30px at 50px 50px)',
    transition: {
      delay: 0.5,
      type: 'spring',
      stiffness: 400,
      damping: 40,
    },
  },
};

// Variants pour l'overlay
const overlayVariants = {
  open: {
    opacity: 1,
    transition: {
      duration: 0.3,
    },
  },
  closed: {
    opacity: 0,
    transition: {
      duration: 0.3,
      delay: 0.2,
    },
  },
};

function Sidebar() {
  const [open, setOpen] = useState(false);

  // Fermer la sidebar lors de la navigation
  const handleNavigation = useCallback(() => {
    setOpen(false);
  }, []);

  // Fermer la sidebar avec Escape
  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === 'Escape' && open) {
        setOpen(false);
      }
    },
    [open],
  );

  // Empêcher le scroll du body quand la sidebar est ouverte
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup lors du démontage
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  // Event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Fermer au clic sur l'overlay
  const handleOverlayClick = useCallback(() => {
    setOpen(false);
  }, []);

  // Toggle avec gestion d'état
  const toggleSidebar = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  return (
    <>
      <motion.div
        className="sidebar"
        animate={open ? 'open' : 'closed'}
        data-state={open ? 'open' : 'closed'}
        initial="closed"
      >
        <motion.div
          className="bg"
          variants={sidebarVariants}
          style={{ originX: 0, originY: 0 }} // Origine de l'animation
        >
          <Links onNavigate={handleNavigation} />
        </motion.div>

        <ToggleButton setOpen={setOpen} isOpen={open} onClick={toggleSidebar} />
      </motion.div>

      {/* Overlay avec backdrop blur */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="sidebar-overlay"
            variants={overlayVariants}
            initial="closed"
            animate="open"
            exit="closed"
            onClick={handleOverlayClick}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default Sidebar;
