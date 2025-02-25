'use client';

import React, { useState } from 'react';
import './orderModal.scss';

const OrderModal = ({
  isOpen,
  onClose,
  platforms,
  applicationId,
  applicationFee,
}) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
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
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validateStep1 = () => {
    if (
      !formData.lastName ||
      !formData.firstName ||
      !formData.email ||
      !formData.phone
    ) {
      setError('Veuillez remplir tous les champs requis');
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Veuillez fournir une adresse email valide');
      return false;
    }

    // Basic phone validation
    const phoneRegex = /^\d{8,}$/; // At least 8 digits
    if (!phoneRegex.test(formData.phone.replace(/\D/g, ''))) {
      setError('Veuillez fournir un numéro de téléphone valide');
      return false;
    }

    setError('');
    return true;
  };

  const validateStep2 = () => {
    if (
      !formData.paymentMethod ||
      !formData.accountName ||
      !formData.accountNumber
    ) {
      setError('Veuillez remplir tous les champs requis');
      return false;
    }
    setError('');
    return true;
  };

  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) {
        setStep(2);
      }
    } else if (step === 2) {
      if (validateStep2()) {
        submitOrder();
      }
    }
  };

  const submitOrder = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          applicationId: applicationId,
          applicationFee: applicationFee,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'Erreur lors de la création de la commande',
        );
      }

      // Move to confirmation step
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="modalOverlay">
      <div className="modal">
        {error && <div className="errorMessage">{error}</div>}

        {step === 1 && (
          <div className="step">
            <h2>Étape 1: Informations personnelles</h2>
            <input
              type="text"
              name="lastName"
              placeholder="Nom de famille"
              value={formData.lastName}
              onChange={handleInputChange}
              required
            />
            <input
              type="text"
              name="firstName"
              placeholder="Prénom"
              value={formData.firstName}
              onChange={handleInputChange}
              required
            />
            <input
              type="email"
              name="email"
              placeholder="Adresse email"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
            <input
              type="tel"
              name="phone"
              placeholder="Numéro de téléphone"
              value={formData.phone}
              onChange={handleInputChange}
              required
            />
            <div className="buttonContainer">
              <button onClick={onClose} className="cancelButton">
                Annuler
              </button>
              <button onClick={handleNext} className="nextButton">
                Suivant
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="step">
            <h2>Étape 2: Méthode de paiement</h2>
            <div className="checkboxGroup">
              {platforms?.map((platform) => (
                <label key={platform?.platform_id} className="radioLabel">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={platform?.platform_id}
                    onChange={handleInputChange}
                    required
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
              required
            />
            <input
              type="text"
              name="accountNumber"
              placeholder="Numéro du compte"
              value={formData.accountNumber}
              onChange={handleInputChange}
              required
            />
            <div className="buttonContainer">
              <button onClick={handleBack} className="backButton">
                Retour
              </button>
              <button
                onClick={handleNext}
                className="nextButton"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Traitement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="step confirmationStep">
            <h2>Étape 3: Confirmation</h2>
            <p>
              Merci pour votre commande. Nous avons bien reçu vos informations
              et nous vous contacterons dans les plus brefs délais pour
              finaliser votre commande. Un email de confirmation vous sera
              envoyé à l'adresse fournie.
            </p>
            <button onClick={onClose} className="closeButton">
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderModal;
