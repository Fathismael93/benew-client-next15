// utils/sentry-utils.js
// Utilitaires Sentry simplifiés - Version minimale
// Focus sur les données critiques uniquement

/**
 * Détecte les données sensibles critiques uniquement
 * @param {string} str - La chaîne à analyser
 * @returns {boolean} - True si des données sensibles critiques sont détectées
 */
export function containsSensitiveData(str) {
  if (!str || typeof str !== 'string') return false;

  // Patterns critiques uniquement - les plus importants
  const criticalPatterns = [
    // Mots de passe et secrets
    /password/i,
    /mot\s*de\s*passe/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,

    // Données de paiement
    /account[_-]?number/i,
    /payment[_-]?method/i,
    /\b(?:\d{4}[ -]?){3}\d{4}\b/, // Numéros de carte (16 chiffres)

    // Informations personnelles critiques
    /email[=:]\s*[^\s@]+@[^\s]+/gi,
    /\b(?:\d{3}[ -]?){2}\d{4}\b/, // Numéros de téléphone (10 chiffres)
  ];

  return criticalPatterns.some((pattern) => pattern.test(str));
}

/**
 * Filtre un message en masquant les parties sensibles
 * @param {string} message - Le message à filtrer
 * @returns {string} - Message filtré
 */
export function filterMessage(message) {
  if (!message || typeof message !== 'string') return message;

  let filteredMessage = message;

  // Patterns de remplacement pour les données sensibles
  const replacements = [
    { pattern: /password[=:]\s*[^\s]+/gi, replacement: 'password=[FILTERED]' },
    { pattern: /token[=:]\s*[^\s]+/gi, replacement: 'token=[FILTERED]' },
    { pattern: /secret[=:]\s*[^\s]+/gi, replacement: 'secret=[FILTERED]' },
    {
      pattern: /api[_-]?key[=:]\s*[^\s]+/gi,
      replacement: 'api_key=[FILTERED]',
    },
    {
      pattern: /email[=:]\s*[^\s@]+@[^\s]+/gi,
      replacement: 'email=[FILTERED]',
    },
    {
      pattern: /\b(?:\d{4}[ -]?){3}\d{4}\b/g,
      replacement: '[CARD_NUMBER_FILTERED]',
    },
  ];

  replacements.forEach(({ pattern, replacement }) => {
    filteredMessage = filteredMessage.replace(pattern, replacement);
  });

  // Si le message est trop long après filtrage, le tronquer
  if (filteredMessage.length > 200) {
    filteredMessage = `${filteredMessage.substring(0, 200)}... [TRUNCATED]`;
  }

  return filteredMessage;
}

/**
 * Valide un DSN Sentry
 * @param {string} dsn - Le DSN à valider
 * @returns {boolean} - True si le DSN est valide
 */
export function isValidDSN(dsn) {
  if (!dsn) return false;
  return /^https:\/\/[^@]+@[^/]+\/\d+$/.test(dsn);
}

/**
 * Vérifie si une URL contient des routes sensibles
 * @param {string} url - L'URL à vérifier
 * @returns {boolean} - True si l'URL est sensible
 */
export function isSensitiveRoute(url) {
  if (!url) return false;

  const sensitiveRoutes = [
    '/api/contact',
    '/api/order',
    '/contact',
    '/order',
    '/admin',
  ];

  return sensitiveRoutes.some((route) => url.includes(route));
}

/**
 * Nettoie les données utilisateur pour Sentry (version ultra-simple)
 * @param {Object} userData - Données utilisateur
 * @returns {Object} - Données nettoyées
 */
export function cleanUserData(userData) {
  if (!userData) return null;

  // Version ultra-simple : juste un ID anonyme
  return {
    id: userData.id || 'anonymous',
    type: 'visitor',
  };
}

/**
 * Formate une erreur pour le logging
 * @param {Error} error - L'erreur à formater
 * @returns {Object} - Erreur formatée
 */
export function formatError(error) {
  if (!error) return null;

  return {
    name: error.name || 'Unknown',
    message: containsSensitiveData(error.message)
      ? filterMessage(error.message)
      : error.message,
    stack: error.stack ? error.stack.substring(0, 500) : null,
  };
}
