// lib/sentry-utils.js
// Fonctions utilitaires partagées pour Sentry
// Extraites de votre instrumentation.js original

/**
 * Fonction pour détecter les données sensibles spécifiques au site Benew
 * @param {string} str - La chaîne à analyser
 * @returns {boolean} - True si des données sensibles sont détectées
 */
export function containsSensitiveData(str) {
  if (!str || typeof str !== 'string') return false;

  // Patterns pour détecter les données sensibles spécifiques à votre application
  const patterns = [
    // Données de commande
    /password/i,
    /mot\s*de\s*passe/i,
    /account[_-]?number/i,
    /numero[_-]?compte/i,
    /payment[_-]?method/i,
    /platform[_-]?id/i,

    // EmailJS et contact
    /emailjs[_-]?service/i,
    /emailjs[_-]?template/i,
    /user[_-]?id/i,
    /private[_-]?key/i,

    // Cloudinary
    /cloudinary[_-]?api[_-]?secret/i,
    /cloudinary[_-]?api[_-]?key/i,
    /upload[_-]?preset/i,

    // Base de données
    /db[_-]?password/i,
    /database[_-]?password/i,
    /connection[_-]?string/i,
    /db[_-]?ca/i,

    // Sentry
    /sentry[_-]?auth[_-]?token/i,
    /sentry[_-]?dsn/i,

    // Données clients
    /client[_-]?email/i,
    /client[_-]?phone/i,
    /order[_-]?client/i,
    /account[_-]?name/i,

    // Numéros sensibles
    /\b(?:\d{4}[ -]?){3}\d{4}\b/, // Numéros de carte
    /\b(?:\d{3}[ -]?){2}\d{4}\b/, // Numéros de téléphone
    /\b\d{8,}\b/, // Numéros de compte génériques
  ];

  return patterns.some((pattern) => pattern.test(str));
}

/**
 * Classification des erreurs par catégorie pour le site Benew
 * @param {Error} error - L'erreur à classifier
 * @returns {string} - Catégorie de l'erreur
 */
export function categorizeError(error) {
  if (!error) return 'unknown';

  const message = error.message || '';
  const name = error.name || '';
  const stack = error.stack || '';
  const combinedText = (message + name + stack).toLowerCase();

  // Erreurs de base de données PostgreSQL
  if (/postgres|pg|database|db|connection|timeout|pool/i.test(combinedText)) {
    return 'database';
  }

  // Erreurs Cloudinary
  if (/cloudinary|image|upload|transform|media/i.test(combinedText)) {
    return 'media_upload';
  }

  // Erreurs EmailJS
  if (/emailjs|email|smtp|mail/i.test(combinedText)) {
    return 'email_service';
  }

  // Erreurs API et réseau
  if (/network|fetch|http|request|response|api/i.test(combinedText)) {
    return 'network';
  }

  // Erreurs de validation Yup
  if (/validation|schema|required|invalid|yup/i.test(combinedText)) {
    return 'validation';
  }

  // Erreurs Framer Motion
  if (/framer|motion|animation|gesture/i.test(combinedText)) {
    return 'animation';
  }

  // Erreurs spécifiques aux entités métier
  if (/template|application|article|blog|order|contact/i.test(combinedText)) {
    return 'business_logic';
  }

  // Erreurs SCSS/styles
  if (/scss|css|style|sass/i.test(combinedText)) {
    return 'styling';
  }

  return 'application';
}

/**
 * Fonction centralisée pour anonymiser les données utilisateur
 * @param {Object} userData - Données utilisateur à anonymiser
 * @returns {Object} - Données utilisateur anonymisées
 */
export function anonymizeUserData(userData) {
  if (!userData) return userData;

  const anonymizedData = { ...userData };

  // Supprimer les informations très sensibles
  delete anonymizedData.ip_address;
  delete anonymizedData.account_number;
  delete anonymizedData.payment_method;

  // Anonymiser l'email
  if (anonymizedData.email) {
    const email = anonymizedData.email;
    const atIndex = email.indexOf('@');
    if (atIndex > 0) {
      const domain = email.slice(atIndex);
      anonymizedData.email = `${email[0]}***${domain}`;
    } else {
      anonymizedData.email = '[FILTERED_EMAIL]';
    }
  }

  // Anonymiser le nom
  if (anonymizedData.firstName || anonymizedData.lastName) {
    if (anonymizedData.firstName) {
      anonymizedData.firstName = anonymizedData.firstName[0] + '***';
    }
    if (anonymizedData.lastName) {
      anonymizedData.lastName = anonymizedData.lastName[0] + '***';
    }
  }

  // Anonymiser le téléphone
  if (anonymizedData.phone) {
    const phone = anonymizedData.phone;
    anonymizedData.phone =
      phone.length > 4
        ? phone.substring(0, 2) + '***' + phone.slice(-2)
        : '[PHONE]';
  }

  // Anonymiser l'ID
  if (anonymizedData.id) {
    const id = String(anonymizedData.id);
    anonymizedData.id =
      id.length > 2 ? id.substring(0, 1) + '***' + id.slice(-1) : '[ID]';
  }

  return anonymizedData;
}

/**
 * Fonction centralisée pour anonymiser les URLs
 * @param {string} url - URL à anonymiser
 * @returns {string} - URL anonymisée
 */
export function anonymizeUrl(url) {
  if (!url) return url;

  try {
    const urlObj = new URL(url);

    // Paramètres sensibles spécifiques à votre application
    const sensitiveParams = [
      'token',
      'password',
      'key',
      'secret',
      'auth',
      'api_key',
      'apikey',
      'cloudinary_api_secret',
      'emailjs_user_id',
      'service_id',
      'template_id',
      'account_number',
      'platform_id',
    ];

    let hasFilteredParams = false;
    sensitiveParams.forEach((param) => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[FILTERED]');
        hasFilteredParams = true;
      }
    });

    // Masquer les IDs dans les URLs pour protéger l'identité
    const pathSegments = urlObj.pathname.split('/');
    const maskedSegments = pathSegments.map((segment) => {
      // Si c'est un ID numérique, le masquer partiellement
      if (/^\d+$/.test(segment) && segment.length > 2) {
        return segment.substring(0, 1) + '***' + segment.slice(-1);
      }
      return segment;
    });

    if (maskedSegments.join('/') !== urlObj.pathname) {
      urlObj.pathname = maskedSegments.join('/');
      hasFilteredParams = true;
    }

    return hasFilteredParams ? urlObj.toString() : url;
  } catch (e) {
    return '[URL_PARSING_ERROR]';
  }
}

/**
 * Fonction centralisée pour anonymiser les headers
 * @param {Object} headers - Headers à anonymiser
 * @returns {Object} - Headers anonymisés
 */
export function anonymizeHeaders(headers) {
  if (!headers) return headers;

  const sanitizedHeaders = { ...headers };

  // Headers sensibles spécifiques à votre stack
  const sensitiveHeaders = [
    'cookie',
    'authorization',
    'x-auth-token',
    'x-api-key',
    'token',
    'auth',
    'x-cloudinary-key',
    'x-emailjs-key',
    'x-forwarded-for', // IP potentiellement sensible
  ];

  sensitiveHeaders.forEach((header) => {
    const lowerHeader = header.toLowerCase();
    Object.keys(sanitizedHeaders).forEach((key) => {
      if (key.toLowerCase() === lowerHeader) {
        sanitizedHeaders[key] = '[FILTERED]';
      }
    });
  });

  return sanitizedHeaders;
}

/**
 * Fonction centralisée pour filtrer le corps des requêtes
 * @param {string|Object} body - Corps de requête à filtrer
 * @returns {string|Object} - Corps de requête filtré
 */
export function filterRequestBody(body) {
  if (!body) return body;

  if (containsSensitiveData(body)) {
    try {
      if (typeof body === 'string') {
        const parsedBody = JSON.parse(body);

        // Spécifiquement filtrer les champs sensibles de votre application
        const sensitiveFields = [
          'password',
          'accountNumber',
          'accountName',
          'paymentMethod',
          'platformId',
          'email',
          'phone',
          'cloudinary_api_secret',
          'emailjs_user_id',
          'service_id',
          'template_id',
        ];

        const filteredBody = { ...parsedBody };
        sensitiveFields.forEach((field) => {
          if (filteredBody[field]) {
            filteredBody[field] = '[FILTERED]';
          }
        });

        return {
          filtered: '[CONTIENT DES DONNÉES SENSIBLES]',
          bodySize: JSON.stringify(parsedBody).length,
          sanitizedPreview:
            JSON.stringify(filteredBody).substring(0, 200) + '...',
        };
      }
    } catch (e) {
      // Parsing JSON échoué
    }
    return '[DONNÉES FILTRÉES]';
  }

  return body;
}

/**
 * Fonction auxiliaire pour créer un hachage simple d'une chaîne
 * @param {string} str - La chaîne à hacher
 * @returns {string} - Le hachage en hexadécimal
 */
export function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Conversion en 32bit integer
  }
  return Math.abs(hash).toString(16);
}
