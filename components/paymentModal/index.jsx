'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import './paymentModal.scss';

function PaymentModal({ setIsOpen }) {
  const [firstPart, setFirstPart] = useState(1);

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleClick = () => {
    // console.log("Beginning of the method : " + firstPart)

    if (firstPart === 1) setFirstPart(2);

    const startTransaction = () => {
      setIsOpen(false);
      // console.log('Paiement éffectué avec succès !');
    };

    if (firstPart === 2) startTransaction();

    // console.log("End of the method : " + firstPart)
  };

  return (
    <div className="popup-container">
      <motion.div
        className="popup-box"
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <h3>Paiement</h3>
        {firstPart === 1 ? (
          <form>
            <input type="text" required placeholder="Nom complet" name="name" />
            <input type="email" required placeholder="Email" name="email" />
            <input
              type="phone"
              required
              placeholder="Numéro de Tél"
              name="subject"
            />
            <div className="radioButtons">
              <div className="categorie">
                <input
                  type="radio"
                  name="categorie"
                  value="waafi"
                  id="website"
                />
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label htmlFor="website">WAAFI</label>
              </div>
              <div className="categorie">
                <input
                  type="radio"
                  name="categorie"
                  value="dmoney"
                  id="mobile"
                />
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label htmlFor="mobile">D-Money</label>
              </div>
            </div>
            <input
              type="text"
              required
              placeholder="Nom associé au compte de paiement"
              name="name"
            />
            <input
              type="text"
              required
              placeholder="Numéro ou identifiant associé au compte de paiement"
              name="name"
            />
          </form>
        ) : (
          <p>
            <strong>Félicitation pour le choix du progrès !</strong> <br />
            Nous vous enverrons un e-mail de confirmation lorsque nous recevrons
            votre paiement. Veuillez nous faire parvenir le montant sur le
            compte : <br />
            <br />
            <strong>WAAFI :</strong> Fathi Ahmed Nour - 77.86.00.64
            <br />
            <br />
            <strong>D-Money :</strong> Fathi Ahmed Nour - 77.86.00.64
            <br />
          </p>
        )}
        <div className="buttons">
          <button type="button" className="close-btn" onClick={handleClose}>
            Quitter
          </button>
          <button type="button" className="next-btn" onClick={handleClick}>
            Continuer
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default PaymentModal;
