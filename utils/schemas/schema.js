import * as yup from 'yup';

/**
 * Schema de validation pour l'ID d'un article (UUID)
 */
export const articleIdSchema = yup.object().shape({
  id: yup
    .string()
    .required('Article ID is required')
    .matches(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      'Invalid article ID format (must be a valid UUID)',
    )
    .test('is-valid-uuid', 'Article ID must be a valid UUID', (value) => {
      if (!value) return false;

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (!uuidRegex.test(value)) {
        return false;
      }

      const emptyUUIDs = [
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
      ];

      return !emptyUUIDs.includes(value.toLowerCase());
    })
    .transform((value) => value?.toLowerCase().trim()),
});

/**
 * Schema de validation pour l'ID d'un template (pour les opérations CRUD)
 * Valide les UUID générés par PostgreSQL
 */
export const templateIdSchema = yup.object().shape({
  id: yup
    .string()
    .required('Template ID is required')
    .matches(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      'Invalid template ID format (must be a valid UUID)',
    )
    .test('is-valid-uuid', 'Template ID must be a valid UUID', (value) => {
      if (!value) return false;

      // Vérifier le format UUID plus strictement
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      if (!uuidRegex.test(value)) {
        return false;
      }

      // Vérifier que ce n'est pas un UUID vide ou par défaut
      const emptyUUIDs = [
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
      ];

      return !emptyUUIDs.includes(value.toLowerCase());
    })
    .transform((value) => value?.toLowerCase().trim()),
});

/**
 * Schema de validation pour l'ID d'une application
 */
export const applicationIdSchema = yup.object().shape({
  id: yup
    .string()
    .required('Application ID is required')
    .matches(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'Application ID must be a valid UUID format',
    )
    .min(36, 'Application ID must be exactly 36 characters')
    .max(36, 'Application ID must be exactly 36 characters')
    .trim(),
});

// =============================
// SCHÉMA MODAL (MOINS STRICT)
// =============================

/**
 * Schéma de validation pour la modal de commande
 * Plus permissif pour une meilleure UX pendant la saisie
 */
export const orderModalSchema = yup.object().shape({
  // Informations personnelles - Étape 1
  lastName: yup
    .string()
    .required('Le nom de famille est requis')
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(50, 'Le nom ne peut pas dépasser 50 caractères')
    .matches(
      /^[a-zA-ZÀ-ÿ\s-']+$/,
      'Le nom ne peut contenir que des lettres, espaces, tirets et apostrophes',
    )
    .trim(),

  firstName: yup
    .string()
    .required('Le prénom est requis')
    .min(2, 'Le prénom doit contenir au moins 2 caractères')
    .max(50, 'Le prénom ne peut pas dépasser 50 caractères')
    .matches(
      /^[a-zA-ZÀ-ÿ\s-']+$/,
      'Le prénom ne peut contenir que des lettres, espaces, tirets et apostrophes',
    )
    .trim(),

  email: yup
    .string()
    .required("L'adresse email est requise")
    .email('Veuillez fournir une adresse email valide')
    .max(100, "L'email ne peut pas dépasser 100 caractères")
    .lowercase()
    .trim(),

  phone: yup
    .string()
    .required('Le numéro de téléphone est requis')
    .min(8, 'Le numéro doit contenir au moins 8 chiffres')
    .max(20, 'Le numéro ne peut pas dépasser 20 caractères')
    .matches(/^[\d\s+()-]+$/, 'Format de téléphone invalide')
    .test(
      'phone-digits',
      'Le numéro doit contenir au moins 8 chiffres',
      (value) => {
        if (!value) return false;
        const digits = value.replace(/\D/g, '');
        return digits.length >= 8;
      },
    )
    .trim(),

  // Informations de paiement - Étape 2
  paymentMethod: yup
    .string()
    .required('Veuillez sélectionner une méthode de paiement')
    .matches(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'ID de plateforme invalide',
    ),

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
});

/**
 * Schéma pour valider l'étape 1 uniquement (informations personnelles)
 */
export const orderModalStep1Schema = orderModalSchema.pick([
  'lastName',
  'firstName',
  'email',
  'phone',
]);

/**
 * Schéma pour valider l'étape 2 uniquement (informations de paiement)
 */
export const orderModalStep2Schema = orderModalSchema.pick([
  'paymentMethod',
  'accountName',
  'accountNumber',
]);

// =============================
// SCHÉMA SERVER ACTION (STRICT)
// =============================

/**
 * Schéma de validation strict pour le server action
 * Validation rigoureuse avant insertion en base de données
 */
export const orderServerSchema = yup.object().shape({
  // Informations personnelles - Validation stricte
  lastName: yup
    .string()
    .required('Le nom de famille est requis')
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(50, 'Le nom ne peut pas dépasser 50 caractères')
    .matches(
      /^[a-zA-ZÀ-ÿ\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\s-'.]+$/,
      'Le nom contient des caractères non autorisés',
    )
    .test('no-numbers', 'Le nom ne peut pas contenir de chiffres', (value) => {
      return value ? !/\d/.test(value) : false;
    })
    .test(
      'no-special-chars',
      'Le nom contient trop de caractères spéciaux',
      (value) => {
        if (!value) return false;
        const specialChars = (value.match(/[-'.]/g) || []).length;
        return specialChars <= 3; // Maximum 3 caractères spéciaux
      },
    )
    .trim()
    .transform((value) => {
      // Capitaliser chaque mot
      return value
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }),

  firstName: yup
    .string()
    .required('Le prénom est requis')
    .min(2, 'Le prénom doit contenir au moins 2 caractères')
    .max(50, 'Le prénom ne peut pas dépasser 50 caractères')
    .matches(
      /^[a-zA-ZÀ-ÿ\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\s-'.]+$/,
      'Le prénom contient des caractères non autorisés',
    )
    .test(
      'no-numbers',
      'Le prénom ne peut pas contenir de chiffres',
      (value) => {
        return value ? !/\d/.test(value) : false;
      },
    )
    .test(
      'no-special-chars',
      'Le prénom contient trop de caractères spéciaux',
      (value) => {
        if (!value) return false;
        const specialChars = (value.match(/[-'.]/g) || []).length;
        return specialChars <= 2; // Maximum 2 caractères spéciaux pour prénom
      },
    )
    .trim()
    .transform((value) => {
      // Capitaliser chaque mot
      return value
        .toLowerCase()
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }),

  email: yup
    .string()
    .required("L'adresse email est requise")
    .email("Format d'email invalide")
    .max(100, "L'email ne peut pas dépasser 100 caractères")
    .matches(
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      "Format d'email invalide",
    )
    .test(
      'no-disposable',
      'Les adresses email temporaires ne sont pas autorisées',
      (value) => {
        if (!value) return false;
        // Liste des domaines d'email temporaires à bloquer
        const disposableDomains = [
          '10minutemail.com',
          'guerrillamail.com',
          'tempmail.org',
          'mailinator.com',
          'yopmail.com',
          'throwaway.email',
        ];
        const domain = value.split('@')[1]?.toLowerCase();
        return !disposableDomains.includes(domain);
      },
    )
    .test('domain-validation', 'Domaine email invalide', (value) => {
      if (!value) return false;
      const domain = value.split('@')[1];
      return domain && domain.includes('.') && domain.length >= 4;
    })
    .lowercase()
    .trim(),

  phone: yup
    .string()
    .required('Le numéro de téléphone est requis')
    .test('phone-validation', 'Numéro de téléphone invalide', (value) => {
      if (!value) return false;

      // Nettoyer le numéro (garder seulement les chiffres et le +)
      const cleanPhone = value.replace(/[\s()-]/g, '');

      // Vérifier le format international ou local
      const internationalRegex = /^\+\d{10,15}$/;
      const localRegex = /^\d{8,12}$/;

      return internationalRegex.test(cleanPhone) || localRegex.test(cleanPhone);
    })
    .test(
      'phone-length',
      'Le numéro doit contenir entre 8 et 15 chiffres',
      (value) => {
        if (!value) return false;
        const digits = value.replace(/\D/g, '');
        return digits.length >= 8 && digits.length <= 15;
      },
    )
    .transform((value) => {
      // Normaliser le format du téléphone
      if (!value) return value;
      return value.replace(/[\s()-]/g, '');
    }),

  // Informations de paiement - Validation stricte
  paymentMethod: yup
    .string()
    .required('La méthode de paiement est requise')
    .matches(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      'ID de plateforme de paiement invalide',
    )
    .test('valid-uuid', 'UUID de plateforme invalide', (value) => {
      if (!value) return false;
      const emptyUUIDs = [
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
      ];
      return !emptyUUIDs.includes(value.toLowerCase());
    })
    .lowercase()
    .trim(),

  accountName: yup
    .string()
    .required('Le nom du compte est requis')
    .min(2, 'Le nom du compte doit contenir au moins 2 caractères')
    .max(100, 'Le nom du compte ne peut pas dépasser 100 caractères')
    .matches(
      /^[a-zA-ZÀ-ÿ\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF0-9\s@._-]+$/,
      'Le nom du compte contient des caractères non autorisés',
    )
    .test(
      'no-only-numbers',
      'Le nom du compte ne peut pas être uniquement des chiffres',
      (value) => {
        return value ? !/^\d+$/.test(value.trim()) : false;
      },
    )
    .test('reasonable-format', 'Format de nom de compte invalide', (value) => {
      if (!value) return false;
      // Vérifier qu'il n'y a pas trop de caractères spéciaux consécutifs
      return !/[._@-]{3,}/.test(value);
    })
    .trim(),

  accountNumber: yup
    .string()
    .required('Le numéro de compte est requis')
    .min(5, 'Le numéro de compte doit contenir au moins 5 caractères')
    .max(50, 'Le numéro de compte ne peut pas dépasser 50 caractères')
    .matches(
      /^[a-zA-Z0-9@._+-]+$/,
      'Le numéro de compte contient des caractères non autorisés',
    )
    .test(
      'has-alphanumeric',
      'Le numéro de compte doit contenir au moins un caractère alphanumérique',
      (value) => {
        return value ? /[a-zA-Z0-9]/.test(value) : false;
      },
    )
    .test(
      'not-sequential',
      'Le numéro de compte ne peut pas être une séquence simple',
      (value) => {
        if (!value) return false;
        // Vérifier qu'il n'y a pas de séquences trop simples
        const sequences = ['123456', '000000', 'aaaaaa', 'abcdef'];
        return !sequences.some((seq) => value.toLowerCase().includes(seq));
      },
    )
    .trim(),

  // Validation des IDs d'application et montant
  applicationId: yup
    .string()
    .required("L'ID de l'application est requis")
    .matches(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      "ID d'application invalide",
    )
    .test('valid-app-uuid', "UUID d'application invalide", (value) => {
      if (!value) return false;
      const emptyUUIDs = [
        '00000000-0000-0000-0000-000000000000',
        'ffffffff-ffff-ffff-ffff-ffffffffffff',
      ];
      return !emptyUUIDs.includes(value.toLowerCase());
    })
    .lowercase()
    .trim(),

  applicationFee: yup
    .number()
    .required("Le montant de l'application est requis")
    .positive('Le montant doit être positif')
    .min(1, 'Le montant minimum est de 1')
    .max(1000000, 'Le montant maximum est de 1,000,000')
    .integer('Le montant doit être un nombre entier')
    .test('reasonable-amount', 'Montant non réaliste', (value) => {
      // Vérifier que le montant est dans une fourchette raisonnable
      return value >= 1 && value <= 500000;
    }),
});

// =============================
// FONCTIONS UTILITAIRES
// =============================

/**
 * Valide les données de la modal (moins strict)
 * @param {Object} data - Données à valider
 * @param {number} step - Étape à valider (1 ou 2, ou undefined pour tout)
 * @returns {Promise<Object>} Résultat de validation
 */
export async function validateOrderModal(data, step = null) {
  try {
    let schema;

    switch (step) {
      case 1:
        schema = orderModalStep1Schema;
        break;
      case 2:
        schema = orderModalStep2Schema;
        break;
      default:
        schema = orderModalSchema;
    }

    const validatedData = await schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
    });

    return {
      success: true,
      data: validatedData,
      errors: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      errors: error.inner.reduce((acc, err) => {
        acc[err.path] = err.message;
        return acc;
      }, {}),
      message: 'Erreurs de validation détectées',
    };
  }
}

/**
 * Valide les données du server action (strict)
 * @param {Object} data - Données à valider
 * @returns {Promise<Object>} Résultat de validation
 */
export async function validateOrderServer(data) {
  try {
    const validatedData = await orderServerSchema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      strict: true,
    });

    return {
      success: true,
      data: validatedData,
      errors: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      errors: error.inner.reduce((acc, err) => {
        acc[err.path] = err.message;
        return acc;
      }, {}),
      message: 'Validation échouée: ' + error.errors.join(', '),
      validationError: true,
    };
  }
}

/**
 * Nettoie et prépare les données du FormData pour validation
 * @param {FormData} formData - FormData à convertir
 * @param {string} applicationId - ID de l'application
 * @param {number} applicationFee - Montant de l'application
 * @returns {Object} Données nettoyées
 */
export function prepareOrderDataFromFormData(
  formData,
  applicationId,
  applicationFee,
) {
  return {
    lastName: formData.get('lastName')?.toString().trim() || '',
    firstName: formData.get('firstName')?.toString().trim() || '',
    email: formData.get('email')?.toString().trim().toLowerCase() || '',
    phone: formData.get('phone')?.toString().trim() || '',
    paymentMethod: formData.get('paymentMethod')?.toString().trim() || '',
    accountName: formData.get('accountName')?.toString().trim() || '',
    accountNumber: formData.get('accountNumber')?.toString().trim() || '',
    applicationId: applicationId?.toString().trim() || '',
    applicationFee: Number(applicationFee) || 0,
  };
}

/**
 * Formate les erreurs de validation pour l'affichage
 * @param {Object} errors - Objet d'erreurs de validation
 * @returns {string} Message d'erreur formaté
 */
export function formatValidationErrors(errors) {
  if (!errors || typeof errors !== 'object') {
    return 'Erreur de validation inconnue';
  }

  const errorMessages = Object.values(errors).filter(Boolean);

  if (errorMessages.length === 0) {
    return 'Erreurs de validation détectées';
  }

  if (errorMessages.length === 1) {
    return errorMessages[0];
  }

  return errorMessages.join(' • ');
}

/**
 * Vérifie si un champ spécifique a une erreur
 * @param {Object} errors - Objet d'erreurs de validation
 * @param {string} fieldName - Nom du champ à vérifier
 * @returns {boolean} True si le champ a une erreur
 */
export function hasFieldError(errors, fieldName) {
  return errors && errors[fieldName] && errors[fieldName].length > 0;
}

/**
 * Récupère le message d'erreur pour un champ spécifique
 * @param {Object} errors - Objet d'erreurs de validation
 * @param {string} fieldName - Nom du champ
 * @returns {string|null} Message d'erreur ou null
 */
export function getFieldError(errors, fieldName) {
  return errors && errors[fieldName] ? errors[fieldName] : null;
}
