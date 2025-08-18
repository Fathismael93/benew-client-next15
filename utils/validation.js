// utils/validation.js
// Fonctions de validation réutilisables pour PostgreSQL UUIDs

/**
 * Valide qu'une chaîne est un UUID v4 valide
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * où x est hexadécimal et y est 8, 9, a, ou b
 *
 * @param {any} value - La valeur à valider
 * @returns {boolean} - true si c'est un UUID valide, false sinon
 */
export function isValidUUID(value) {
  // Vérifier que c'est une chaîne
  if (typeof value !== 'string') {
    return false;
  }

  // Regex pour UUID v4 (plus strict que PostgreSQL qui accepte plusieurs versions)
  const uuidV4Regex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return uuidV4Regex.test(value);
}

/**
 * Valide qu'une chaîne est un UUID PostgreSQL valide (versions 1-5)
 * Plus permissif que isValidUUID - accepte toutes les versions d'UUID
 *
 * @param {any} value - La valeur à valider
 * @returns {boolean} - true si c'est un UUID PostgreSQL valide, false sinon
 */
export function isValidPostgreSQLUUID(value) {
  // Vérifier que c'est une chaîne
  if (typeof value !== 'string') {
    return false;
  }

  // Regex pour UUID PostgreSQL (toutes versions)
  const postgresUuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return postgresUuidRegex.test(value);
}

/**
 * Valide et nettoie un UUID (supprime les espaces, convertit en minuscules)
 *
 * @param {any} value - La valeur à nettoyer et valider
 * @returns {string|null} - UUID nettoyé si valide, null sinon
 */
export function sanitizeAndValidateUUID(value) {
  if (typeof value !== 'string') {
    return null;
  }

  // Nettoyer la chaîne
  const cleaned = value.trim().toLowerCase();

  // Valider
  if (isValidPostgreSQLUUID(cleaned)) {
    return cleaned;
  }

  return null;
}

/**
 * Valide un tableau d'UUIDs
 *
 * @param {any[]} values - Tableau de valeurs à valider
 * @returns {boolean} - true si tous les éléments sont des UUIDs valides
 */
export function areValidUUIDs(values) {
  if (!Array.isArray(values)) {
    return false;
  }

  if (values.length === 0) {
    return false;
  }

  return values.every((value) => isValidPostgreSQLUUID(value));
}

/**
 * Fonction d'assertion pour les UUIDs - lance une erreur si invalide
 * Utile pour les validations strictes
 *
 * @param {any} value - La valeur à valider
 * @param {string} fieldName - Nom du champ pour l'erreur
 * @throws {Error} - Si l'UUID n'est pas valide
 * @returns {string} - L'UUID validé
 */
export function assertValidUUID(value, fieldName = 'UUID') {
  const sanitized = sanitizeAndValidateUUID(value);

  if (!sanitized) {
    throw new Error(`${fieldName} must be a valid UUID format`);
  }

  return sanitized;
}

// Exemples d'utilisation :

/*
// Dans vos composants Next.js :

import { isValidPostgreSQLUUID, sanitizeAndValidateUUID } from '@/utils/validation';

// Validation simple
if (!isValidPostgreSQLUUID(templateId)) {
  notFound();
}

// Avec nettoyage
const cleanTemplateId = sanitizeAndValidateUUID(templateId);
if (!cleanTemplateId) {
  notFound();
}

// Validation stricte avec erreur
try {
  const validatedId = assertValidUUID(templateId, 'Template ID');
  // Continuer avec validatedId
} catch (error) {
  notFound();
}

// Pour plusieurs IDs
const ids = ['id1', 'id2', 'id3'];
if (!areValidUUIDs(ids)) {
  notFound();
}
*/
