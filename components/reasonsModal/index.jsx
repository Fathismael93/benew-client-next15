'use client';

import React from 'react';
import { motion } from 'framer-motion';
import './reasonsModal.scss';
import { MdAdd } from 'react-icons/md';

function ReasonsModal({ setIsOpen, title, reasons }) {
  const arrayID = [];
  let id = 1;

  for (let count = 0; count < reasons.length; count += 1) {
    arrayID.push(id);
    id += 1;
  }

  return (
    <div className="popup-container">
      <motion.div
        className="popup-box"
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h3>{title}</h3>
        <ul>
          {reasons?.map((reason, index) => (
            <li key={arrayID[index]}>
              <div>
                <MdAdd />
              </div>
              <p>{reason}</p>
            </li>
          ))}
        </ul>
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

export default ReasonsModal;
