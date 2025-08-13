// utils/schemas/schema.js
// Schemas de validation ULTRA-SIMPLIFIÉS pour 500 visiteurs/jour
// Stop à la suringénierie !

import * as yup from 'yup';

// =============================
// SCHEMA COMMANDE SIMPLIFIÉ
// =============================

export const orderServerSchema = yup.object().shape({
  // Informations personnelles
  lastName: yup
    .string()
    .required('Le nom est requis')
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(50, 'Le nom ne peut pas dépasser 50 caractères')
    .trim(),

  firstName: yup
    .string()
    .required('Le prénom est requis')
    .min(2, 'Le prénom doit contenir au moins 2 caractères')
    .max(50, 'Le prénom ne peut pas dépasser 50 caractères')
    .trim(),

  email: yup
    .string()
    .required("L'adresse email est requise")
    .email("Format d'email invalide")
    .max(100, "L'email ne peut pas dépasser 100 caractères")
    .trim(),

  phone: yup
    .string()
    .required('Le numéro de téléphone est requis')
    .min(8, 'Le numéro doit contenir au moins 8 chiffres')
    .max(20, 'Le numéro ne peut pas dépasser 20 caractères')
    .trim(),

  // Informations de paiement
  paymentMethod: yup
    .string()
    .required('La méthode de paiement est requise')
    .trim(),

  accountName: yup
    .string()
    .required('Le nom du compte est requis')
    .min(2, 'Le nom du compte doit contenir au moins 2 caractères')
    .max(100, 'Le nom du compte ne peut pas dépasser 100 caractères')
    .trim(),

  accountNumber: yup
    .string()
    .required('Le numéro de compte est requis')
    .min(5, 'Le numéro de compte doit contenir au moins 5 caractères')
    .max(50, 'Le numéro de compte ne peut pas dépasser 50 caractères')
    .trim(),

  // IDs et montant
  applicationId: yup
    .string()
    .required("L'ID de l'application est requis")
    .trim(),

  applicationFee: yup
    .number()
    .required("Le montant de l'application est requis")
    .positive('Le montant doit être positif')
    .min(1, 'Le montant minimum est de 1')
    .max(100000, 'Le montant maximum est de 100,000'),
});

// =============================
// FONCTIONS UTILITAIRES
// =============================

/**
 * Valide les données du server action
 */
export async function validateOrderServer(data) {
  try {
    const validatedData = await orderServerSchema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
    });

    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    const errors = {};

    if (error.inner) {
      error.inner.forEach((err) => {
        if (err.path) {
          errors[err.path] = err.message;
        }
      });
    }

    return {
      success: false,
      errors,
    };
  }
}

/**
 * Prépare les données du FormData
 */
export function prepareOrderDataFromFormData(
  formData,
  applicationId,
  applicationFee,
) {
  return {
    lastName: formData.get('lastName') || '',
    firstName: formData.get('firstName') || '',
    email: formData.get('email') || '',
    phone: formData.get('phone') || '',
    paymentMethod: formData.get('paymentMethod') || '',
    accountName: formData.get('accountName') || '',
    accountNumber: formData.get('accountNumber') || '',
    applicationId: applicationId || '',
    applicationFee: Number(applicationFee) || 0,
  };
}

/**
 * Formate les erreurs de validation
 */
export function formatValidationErrors(errors) {
  if (!errors) return 'Erreurs de validation';

  return Object.values(errors).join(', ');
}
