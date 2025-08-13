// utils/sanitizers/orderSanitizer.js
// Sanitization ULTRA-SIMPLIFIÉE pour 500 visiteurs/jour
// On arrête la paranoia !

import { captureException } from '../../instrumentation';

// =============================
// SANITIZATION DE BASE
// =============================

/**
 * Nettoie une chaîne de caractères basique
 */
function cleanString(input) {
  if (!input || typeof input !== 'string') return '';

  return input
    .trim()
    .replace(/[<>]/g, '') // Supprimer < et >
    .substring(0, 200); // Limiter la longueur
}

/**
 * Sanitize les données de commande - VERSION SIMPLE
 */
export function sanitizeOrderData(orderData) {
  try {
    if (!orderData || typeof orderData !== 'object') {
      return {
        success: false,
        sanitized: null,
      };
    }

    const sanitized = {
      lastName: cleanString(orderData.lastName),
      firstName: cleanString(orderData.firstName),
      email: cleanString(orderData.email)?.toLowerCase(),
      phone: cleanString(orderData.phone),
      paymentMethod: cleanString(orderData.paymentMethod),
      accountName: cleanString(orderData.accountName),
      accountNumber: cleanString(orderData.accountNumber),
      applicationId: cleanString(orderData.applicationId),
      applicationFee: Number(orderData.applicationFee) || 0,
    };

    // Vérifier que les champs ne sont pas vides
    const hasAllFields = Object.values(sanitized).every(
      (value) => value !== '' && value !== 0,
    );

    return {
      success: hasAllFields,
      sanitized: hasAllFields ? sanitized : null,
    };
  } catch (error) {
    captureException(error, {
      tags: { component: 'order_sanitizer' },
    });

    return {
      success: false,
      sanitized: null,
    };
  }
}

/**
 * Validation métier basique
 */
export function validateBusinessRules(sanitizedData) {
  if (!sanitizedData) {
    return {
      valid: false,
      violations: ['Données manquantes'],
    };
  }

  const violations = [];

  // Vérifications basiques
  if (sanitizedData.applicationFee < 1) {
    violations.push('Montant invalide');
  }

  if (!sanitizedData.email.includes('@')) {
    violations.push('Email invalide');
  }

  if (sanitizedData.phone.replace(/\D/g, '').length < 8) {
    violations.push('Téléphone trop court');
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Vérification de sécurité finale
 */
export function validateSanitizedDataSafety(sanitizedData) {
  if (!sanitizedData) {
    return { safe: false };
  }

  // Vérification simple - pas d'injection évidente
  const allValues = Object.values(sanitizedData).join(' ');
  const hasScript = allValues.toLowerCase().includes('script');
  const hasSql = /drop|delete|insert|update/i.test(allValues);

  return {
    safe: !hasScript && !hasSql,
  };
}
