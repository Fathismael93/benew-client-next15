'use client';

import React from 'react';
import { motion } from 'framer-motion';
import './detailsModal.scss';

function DetailsModal({
  setIsOpen,
  title = 'Pas de titre',
  text = 'Contenu vide',
}) {
  return (
    <div className="popup-container">
      <motion.div
        className="popup-box"
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h3>{title}</h3>
        <p>{text}</p>
        <button
          type="button"
          className="close-btn"
          onClick={() => setIsOpen(false)}
        >
          Quitter
        </button>
      </motion.div>
    </div>
  );
}

export default DetailsModal;
