'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Links from './links';
import './styles/index.scss';
import ToggleButton from './toggleButton';

function Sidebar() {
  const [open, setOpen] = useState(false);

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
