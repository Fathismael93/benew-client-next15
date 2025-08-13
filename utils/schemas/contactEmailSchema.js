// utils/schemas/contactEmailSchema.js
// Schema de validation contact ULTRA-SIMPLIFIÉ pour 500 visiteurs/jour
// Fini la suringénierie !

import * as yup from 'yup';

// Schema Yup basique - juste les validations essentielles
export const contactEmailSchema = yup.object({
  name: yup
    .string()
    .required('Le nom est obligatoire')
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(50, 'Le nom ne peut pas dépasser 50 caractères')
    .trim(),

  email: yup
    .string()
    .required("L'adresse email est obligatoire")
    .email("L'adresse email n'est pas valide")
    .max(100, "L'email ne peut pas dépasser 100 caractères")
    .trim(),

  subject: yup
    .string()
    .required('Le sujet est obligatoire')
    .min(3, 'Le sujet doit contenir au moins 3 caractères')
    .max(100, 'Le sujet ne peut pas dépasser 100 caractères')
    .trim(),

  message: yup
    .string()
    .required('Le message est obligatoire')
    .min(10, 'Le message doit contenir au moins 10 caractères')
    .max(1000, 'Le message ne peut pas dépasser 1000 caractères')
    .trim(),
});

// Fonction simple pour préparer les données du FormData
export function prepareContactDataFromFormData(formData) {
  return {
    name: formData.get('name') || '',
    email: formData.get('email') || '',
    subject: formData.get('subject') || '',
    message: formData.get('message') || '',
  };
}

// Validation avec le schema
export async function validateContactEmail(data) {
  try {
    const validatedData = await contactEmailSchema.validate(data, {
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

// Formatage simple des erreurs
export function formatContactValidationErrors(errors) {
  if (!errors) return 'Erreurs de validation';

  return Object.values(errors).join(', ');
}

// Bot detection basique (optionnel)
export function detectBotBehavior(data, metadata = {}) {
  let riskScore = 0;

  // Remplissage trop rapide (moins de 3 secondes)
  if (metadata.fillTime && metadata.fillTime < 3000) {
    riskScore += 5;
  }

  // Email suspect
  if (data.email.includes('test@test') || data.email.includes('admin@admin')) {
    riskScore += 3;
  }

  return {
    riskScore,
    isSuspicious: riskScore >= 5,
  };
}
