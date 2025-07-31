'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Links from './links';
import './sidebar.scss';
import ToggleButton from './toggleButton';

// Hook pour détecter les petits écrans
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Fonction pour vérifier la taille d'écran
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768); // < md breakpoint
    };

    // Vérification initiale
    checkScreenSize();

    // Écouter les changements de taille d'écran
    window.addEventListener('resize', checkScreenSize);

    // Nettoyage
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  return isMobile;
};

function Sidebar() {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  // Variants adaptatifs selon la taille d'écran
  const variants = {
    open: {
      clipPath: 'circle(1200px at 50px 50px)', // Inchangé
      transition: {
        type: 'spring',
        stiffness: 20,
      },
    },
    closed: {
      // Adaptatif selon la taille d'écran
      // clipPath: isMobile
      //   ? 'circle(0px at 50px 50px)'
      //   : 'circle(30px at 50px 50px)',
      clipPath: 'circle(0px at 50px 50px)',
      transition: {
        delay: 0.5,
        type: 'spring',
        stiffness: 400,
        damping: 40,
      },
    },
  };

  return (
    <motion.div className="sidebar" animate={open ? 'open' : 'closed'}>
      <motion.div className="bg" variants={variants}>
        <Links />
      </motion.div>
      <ToggleButton setOpen={setOpen} />
    </motion.div>
  );
}

export default Sidebar;
