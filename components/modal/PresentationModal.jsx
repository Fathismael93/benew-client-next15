'use client';

import React from 'react';
import './presentationModal.scss';

const PresentationModal = ({ isOpen, onClose, content }) => {
  if (!isOpen || !content) return null;

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modalContent">
          <h2>{content.title}</h2>
          <div className="modalText">
            {content.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <button onClick={onClose} className="closeButton">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default PresentationModal;
