'use client';

import React, { useState } from 'react';
import './orderModal.scss';

const OrderModal = ({ isOpen, onClose, platforms }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    email: '',
    phone: '',
    paymentMethod: '',
    accountName: '',
    accountNumber: '',
  });

  const handleInputChange = (e) => {
    console.log('Platform choosen: ');
    console.log(e.target.name);
    console.log(e.target.value);
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleNext = () => {
    setStep(step + 1);
  };

  if (!isOpen) return null;

  return (
    <div className="modalOverlay">
      <div className="modal">
        {step === 1 && (
          <div className="step">
            <h2>Étape 1: Informations personnelles</h2>
            <input
              type="text"
              name="lastName"
              placeholder="Nom de famille"
              value={formData.lastName}
              onChange={handleInputChange}
            />
            <input
              type="text"
              name="firstName"
              placeholder="Prénom"
              value={formData.firstName}
              onChange={handleInputChange}
            />
            <input
              type="email"
              name="email"
              placeholder="Adresse email"
              value={formData.email}
              onChange={handleInputChange}
            />
            <input
              type="tel"
              name="phone"
              placeholder="Numéro de téléphone"
              value={formData.phone}
              onChange={handleInputChange}
            />
            <button onClick={handleNext}>Suivant</button>
          </div>
        )}

        {step === 2 && (
          <div className="step">
            <h2>Étape 2: Méthode de paiement</h2>
            <div className="checkboxGroup">
              {platforms?.map((platform) => (
                <label key={platform?.platform_id}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="evc"
                    onChange={handleInputChange}
                  />
                  {platform?.platform_name}
                </label>
              ))}
            </div>
            <input
              type="text"
              name="accountName"
              placeholder="Nom du compte"
              value={formData.accountName}
              onChange={handleInputChange}
            />
            <input
              type="text"
              name="accountNumber"
              placeholder="Numéro du compte"
              value={formData.accountNumber}
              onChange={handleInputChange}
            />
            <button onClick={handleNext}>Suivant</button>
          </div>
        )}

        {step === 3 && (
          <div className="step">
            <h2>Étape 3: Confirmation</h2>
            <p>
              Merci pour votre commande. Nous avons bien reçu vos informations
              et nous vous contacterons dans les plus brefs délais pour
              finaliser votre commande. Un email de confirmation vous sera
              envoyé à l'adresse fournie.
            </p>
            <button onClick={onClose}>Fermer la modal</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderModal;
