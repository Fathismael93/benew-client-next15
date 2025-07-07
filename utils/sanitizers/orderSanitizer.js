// utils/sanitizers/orderSanitizer.js
// Système de sanitization avancé pour les données de commande
// Protection contre XSS, injection SQL, et autres attaques

import { captureMessage, captureException } from '@/instrumentation';

// =============================
// CONFIGURATION DE SANITIZATION
// =============================

const SANITIZER_CONFIG = {
  // Caractères dangereux à supprimer/encoder
  dangerous: {
    xss: [
      '<script',
      '</script',
      'javascript:',
      'onload=',
      'onerror=',
      'onclick=',
    ],
    sql: [
      "'",
      '"',
      ';',
      '--',
      '/*',
      '*/',
      'DROP',
      'DELETE',
      'INSERT',
      'UPDATE',
    ],
    control: [
      '\x00',
      '\x01',
      '\x02',
      '\x03',
      '\x04',
      '\x05',
      '\x06',
      '\x07',
      '\x08',
      '\x0E',
      '\x0F',
    ],
  },

  // Limites de taille
  limits: {
    name: 100,
    email: 150,
    phone: 25,
    accountName: 150,
    accountNumber: 100,
  },

  // Patterns autorisés
  patterns: {
    name: /^[a-zA-ZÀ-ÿ\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\s\-'.]+$/,
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    phone: /^[\d\s+()\-.]+$/,
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    accountName:
      /^[a-zA-ZÀ-ÿ\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF0-9\s@._-]+$/,
    accountNumber: /^[a-zA-Z0-9@._+-]+$/,
  },

  // Mots suspicieux à détecter
  suspicious: [
    'admin',
    'administrator',
    'root',
    'system',
    'test',
    'demo',
    'null',
    'undefined',
    'script',
    'eval',
    'function',
    'alert',
    'console',
    'document',
    'window',
    'location',
    'cookie',
  ],
};

// =============================
// FONCTIONS DE SANITIZATION DE BASE
// =============================

/**
 * Supprime les caractères de contrôle dangereux
 * @param {string} input - Chaîne à nettoyer
 * @returns {string} Chaîne nettoyée
 */
function removeControlCharacters(input) {
  if (typeof input !== 'string') return '';

  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Encode les entités HTML dangereuses
 * @param {string} input - Chaîne à encoder
 * @returns {string} Chaîne encodée
 */
function encodeHtmlEntities(input) {
  if (typeof input !== 'string') return '';

  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };

  return input.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char]);
}

/**
 * Supprime les séquences XSS courantes
 * @param {string} input - Chaîne à nettoyer
 * @returns {string} Chaîne nettoyée
 */
function removeXssPatterns(input) {
  if (typeof input !== 'string') return '';

  let cleaned = input;

  // Patterns XSS dangereux
  const xssPatterns = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
    /<object[\s\S]*?>[\s\S]*?<\/object>/gi,
    /<embed[\s\S]*?>/gi,
    /<link[\s\S]*?>/gi,
    /<meta[\s\S]*?>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
    /onclick\s*=/gi,
    /onmouseover\s*=/gi,
    /onfocus\s*=/gi,
    /onblur\s*=/gi,
    /expression\s*\(/gi,
    /url\s*\(/gi,
  ];

  xssPatterns.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, '');
  });

  return cleaned;
}

/**
 * Supprime les caractères de type injection SQL
 * @param {string} input - Chaîne à nettoyer
 * @returns {string} Chaîne nettoyée
 */
function removeSqlInjectionPatterns(input) {
  if (typeof input !== 'string') return '';

  let cleaned = input;

  // Patterns SQL dangereux
  const sqlPatterns = [
    /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT|MERGE|SELECT|UPDATE|UNION|USE)\b)/gi,
    /(;|--|\/\*|\*\/)/g,
    /(\b(AND|OR)\b.*\b(=|LIKE)\b)/gi,
    /(1\s*=\s*1|1\s*=\s*'1'|'.*'.*=.*'.*')/gi,
    /(\bUNION\b.*\bSELECT\b)/gi,
    /(\bINSERT\b.*\bINTO\b)/gi,
    /(\bDELETE\b.*\bFROM\b)/gi,
    /(\bUPDATE\b.*\bSET\b)/gi,
  ];

  sqlPatterns.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, '');
  });

  return cleaned;
}

/**
 * Détecte les mots suspicieux dans une chaîne
 * @param {string} input - Chaîne à analyser
 * @returns {Array} Liste des mots suspicieux trouvés
 */
function detectSuspiciousWords(input) {
  if (typeof input !== 'string') return [];

  const lowerInput = input.toLowerCase();
  const foundSuspicious = [];

  SANITIZER_CONFIG.suspicious.forEach((word) => {
    if (lowerInput.includes(word.toLowerCase())) {
      foundSuspicious.push(word);
    }
  });

  return foundSuspicious;
}

/**
 * Normalise les espaces et caractères invisibles
 * @param {string} input - Chaîne à normaliser
 * @returns {string} Chaîne normalisée
 */
function normalizeWhitespace(input) {
  if (typeof input !== 'string') return '';

  return input
    .replace(/\s+/g, ' ') // Remplacer multiples espaces par un seul
    .replace(/^\s+|\s+$/g, '') // Supprimer espaces en début/fin
    .replace(/\u00A0/g, ' ') // Remplacer espaces insécables
    .replace(/\u2000-\u200F/g, ' ') // Remplacer autres espaces Unicode
    .trim();
}

// =============================
// FONCTIONS DE SANITIZATION SPÉCIALISÉES
// =============================

/**
 * Sanitize un nom (prénom/nom de famille)
 * @param {string} name - Nom à sanitizer
 * @param {string} fieldName - Nom du champ pour les logs
 * @returns {Object} Résultat de sanitization
 */
function sanitizeName(name, fieldName = 'name') {
  try {
    if (!name || typeof name !== 'string') {
      return {
        success: false,
        sanitized: '',
        issues: [`${fieldName} is empty or invalid type`],
        originalLength: 0,
        sanitizedLength: 0,
      };
    }

    let sanitized = name;
    const issues = [];
    const originalLength = name.length;

    // Étapes de nettoyage
    sanitized = removeControlCharacters(sanitized);
    sanitized = removeXssPatterns(sanitized);
    sanitized = removeSqlInjectionPatterns(sanitized);
    sanitized = normalizeWhitespace(sanitized);

    // Vérifier la longueur
    if (sanitized.length > SANITIZER_CONFIG.limits.name) {
      sanitized = sanitized.substring(0, SANITIZER_CONFIG.limits.name);
      issues.push(
        `${fieldName} truncated to ${SANITIZER_CONFIG.limits.name} characters`,
      );
    }

    // Vérifier le pattern autorisé
    if (sanitized && !SANITIZER_CONFIG.patterns.name.test(sanitized)) {
      // Supprimer les caractères non autorisés
      sanitized = sanitized.replace(
        /[^a-zA-ZÀ-ÿ\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\s\-'.]/g,
        '',
      );
      issues.push(`${fieldName} contained unauthorized characters`);
    }

    // Capitaliser proprement
    sanitized = sanitized
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Détecter mots suspicieux
    const suspiciousWords = detectSuspiciousWords(sanitized);
    if (suspiciousWords.length > 0) {
      issues.push(
        `${fieldName} contains suspicious words: ${suspiciousWords.join(', ')}`,
      );
    }

    return {
      success: sanitized.length >= 2, // Minimum 2 caractères
      sanitized: sanitized.trim(),
      issues,
      originalLength,
      sanitizedLength: sanitized.length,
      suspiciousWords,
    };
  } catch (error) {
    captureException(error, {
      tags: { component: 'order_sanitizer', operation: 'sanitize_name' },
      extra: { fieldName, originalValue: name?.substring(0, 50) },
    });

    return {
      success: false,
      sanitized: '',
      issues: ['Sanitization error occurred'],
      originalLength: name?.length || 0,
      sanitizedLength: 0,
    };
  }
}

/**
 * Sanitize une adresse email
 * @param {string} email - Email à sanitizer
 * @returns {Object} Résultat de sanitization
 */
function sanitizeEmail(email) {
  try {
    if (!email || typeof email !== 'string') {
      return {
        success: false,
        sanitized: '',
        issues: ['Email is empty or invalid type'],
        originalLength: 0,
        sanitizedLength: 0,
      };
    }

    let sanitized = email;
    const issues = [];
    const originalLength = email.length;

    // Étapes de nettoyage
    sanitized = removeControlCharacters(sanitized);
    sanitized = removeXssPatterns(sanitized);
    sanitized = removeSqlInjectionPatterns(sanitized);
    sanitized = normalizeWhitespace(sanitized);
    sanitized = sanitized.toLowerCase();

    // Vérifier la longueur
    if (sanitized.length > SANITIZER_CONFIG.limits.email) {
      sanitized = sanitized.substring(0, SANITIZER_CONFIG.limits.email);
      issues.push(
        `Email truncated to ${SANITIZER_CONFIG.limits.email} characters`,
      );
    }

    // Vérifier le format email
    if (sanitized && !SANITIZER_CONFIG.patterns.email.test(sanitized)) {
      issues.push('Email format is invalid after sanitization');
      return {
        success: false,
        sanitized,
        issues,
        originalLength,
        sanitizedLength: sanitized.length,
      };
    }

    // Vérifier les domaines suspects
    if (sanitized) {
      const domain = sanitized.split('@')[1];
      const suspiciousDomains = [
        'tempmail',
        'throwaway',
        '10minutemail',
        'guerrillamail',
      ];

      if (
        suspiciousDomains.some((suspDomain) => domain?.includes(suspDomain))
      ) {
        issues.push('Email domain appears to be temporary/disposable');
      }
    }

    return {
      success:
        sanitized.length > 5 &&
        sanitized.includes('@') &&
        sanitized.includes('.'),
      sanitized: sanitized.trim(),
      issues,
      originalLength,
      sanitizedLength: sanitized.length,
    };
  } catch (error) {
    captureException(error, {
      tags: { component: 'order_sanitizer', operation: 'sanitize_email' },
      extra: { originalValue: email?.substring(0, 50) },
    });

    return {
      success: false,
      sanitized: '',
      issues: ['Email sanitization error occurred'],
      originalLength: email?.length || 0,
      sanitizedLength: 0,
    };
  }
}

/**
 * Sanitize un numéro de téléphone
 * @param {string} phone - Téléphone à sanitizer
 * @returns {Object} Résultat de sanitization
 */
function sanitizePhone(phone) {
  try {
    if (!phone || typeof phone !== 'string') {
      return {
        success: false,
        sanitized: '',
        issues: ['Phone is empty or invalid type'],
        originalLength: 0,
        sanitizedLength: 0,
      };
    }

    let sanitized = phone;
    const issues = [];
    const originalLength = phone.length;

    // Étapes de nettoyage
    sanitized = removeControlCharacters(sanitized);
    sanitized = removeXssPatterns(sanitized);
    sanitized = removeSqlInjectionPatterns(sanitized);
    sanitized = normalizeWhitespace(sanitized);

    // Vérifier la longueur
    if (sanitized.length > SANITIZER_CONFIG.limits.phone) {
      sanitized = sanitized.substring(0, SANITIZER_CONFIG.limits.phone);
      issues.push(
        `Phone truncated to ${SANITIZER_CONFIG.limits.phone} characters`,
      );
    }

    // Supprimer caractères non autorisés
    sanitized = sanitized.replace(/[^\d\s+()\-.]/g, '');

    // Compter les chiffres
    const digitCount = (sanitized.match(/\d/g) || []).length;

    if (digitCount < 8) {
      issues.push('Phone number has insufficient digits');
      return {
        success: false,
        sanitized,
        issues,
        originalLength,
        sanitizedLength: sanitized.length,
      };
    }

    if (digitCount > 15) {
      issues.push('Phone number has too many digits');
    }

    // Normaliser le format
    sanitized = sanitized.replace(/\s+/g, '').replace(/[()]/g, '');

    return {
      success: digitCount >= 8 && digitCount <= 15,
      sanitized: sanitized.trim(),
      issues,
      originalLength,
      sanitizedLength: sanitized.length,
      digitCount,
    };
  } catch (error) {
    captureException(error, {
      tags: { component: 'order_sanitizer', operation: 'sanitize_phone' },
      extra: { originalValue: phone?.substring(0, 20) },
    });

    return {
      success: false,
      sanitized: '',
      issues: ['Phone sanitization error occurred'],
      originalLength: phone?.length || 0,
      sanitizedLength: 0,
    };
  }
}

/**
 * Sanitize un UUID
 * @param {string} uuid - UUID à sanitizer
 * @param {string} fieldName - Nom du champ pour les logs
 * @returns {Object} Résultat de sanitization
 */
function sanitizeUuid(uuid, fieldName = 'uuid') {
  try {
    if (!uuid || typeof uuid !== 'string') {
      return {
        success: false,
        sanitized: '',
        issues: [`${fieldName} is empty or invalid type`],
        originalLength: 0,
        sanitizedLength: 0,
      };
    }

    let sanitized = uuid;
    const issues = [];
    const originalLength = uuid.length;

    // Étapes de nettoyage
    sanitized = removeControlCharacters(sanitized);
    sanitized = removeXssPatterns(sanitized);
    sanitized = removeSqlInjectionPatterns(sanitized);
    sanitized = normalizeWhitespace(sanitized);
    sanitized = sanitized.toLowerCase();

    // Vérifier le format UUID
    if (!SANITIZER_CONFIG.patterns.uuid.test(sanitized)) {
      issues.push(`${fieldName} format is invalid`);
      return {
        success: false,
        sanitized,
        issues,
        originalLength,
        sanitizedLength: sanitized.length,
      };
    }

    // Vérifier les UUIDs vides ou par défaut
    const emptyUuids = [
      '00000000-0000-0000-0000-000000000000',
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
    ];

    if (emptyUuids.includes(sanitized)) {
      issues.push(`${fieldName} is a default/empty UUID`);
      return {
        success: false,
        sanitized,
        issues,
        originalLength,
        sanitizedLength: sanitized.length,
      };
    }

    return {
      success: true,
      sanitized: sanitized.trim(),
      issues,
      originalLength,
      sanitizedLength: sanitized.length,
    };
  } catch (error) {
    captureException(error, {
      tags: { component: 'order_sanitizer', operation: 'sanitize_uuid' },
      extra: { fieldName, originalValue: uuid?.substring(0, 50) },
    });

    return {
      success: false,
      sanitized: '',
      issues: [`${fieldName} sanitization error occurred`],
      originalLength: uuid?.length || 0,
      sanitizedLength: 0,
    };
  }
}

/**
 * Sanitize des informations de compte de paiement
 * @param {string} accountInfo - Information de compte à sanitizer
 * @param {string} fieldName - Nom du champ
 * @returns {Object} Résultat de sanitization
 */
function sanitizeAccountInfo(accountInfo, fieldName = 'account') {
  try {
    if (!accountInfo || typeof accountInfo !== 'string') {
      return {
        success: false,
        sanitized: '',
        issues: [`${fieldName} is empty or invalid type`],
        originalLength: 0,
        sanitizedLength: 0,
      };
    }

    let sanitized = accountInfo;
    const issues = [];
    const originalLength = accountInfo.length;

    // Étapes de nettoyage
    sanitized = removeControlCharacters(sanitized);
    sanitized = removeXssPatterns(sanitized);
    sanitized = removeSqlInjectionPatterns(sanitized);
    sanitized = normalizeWhitespace(sanitized);

    // Vérifier la longueur selon le type de champ
    const limit = fieldName.includes('Name')
      ? SANITIZER_CONFIG.limits.accountName
      : SANITIZER_CONFIG.limits.accountNumber;

    if (sanitized.length > limit) {
      sanitized = sanitized.substring(0, limit);
      issues.push(`${fieldName} truncated to ${limit} characters`);
    }

    // Appliquer le pattern selon le type
    const pattern = fieldName.includes('Name')
      ? SANITIZER_CONFIG.patterns.accountName
      : SANITIZER_CONFIG.patterns.accountNumber;

    if (sanitized && !pattern.test(sanitized)) {
      // Supprimer caractères non autorisés
      const allowedChars = fieldName.includes('Name')
        ? /[^a-zA-ZÀ-ÿ\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF0-9\s@._-]/g
        : /[^a-zA-Z0-9@._+-]/g;

      sanitized = sanitized.replace(allowedChars, '');
      issues.push(`${fieldName} contained unauthorized characters`);
    }

    // Vérifications spéciales pour numéro de compte
    if (fieldName.includes('Number')) {
      // Vérifier séquences suspectes
      const suspiciousPatterns = [
        '123456',
        '000000',
        'aaaaaa',
        'test',
        'admin',
      ];
      const hasSuspiciousPattern = suspiciousPatterns.some((pattern) =>
        sanitized.toLowerCase().includes(pattern),
      );

      if (hasSuspiciousPattern) {
        issues.push(`${fieldName} contains suspicious patterns`);
      }

      // Vérifier qu'il y a au moins un caractère alphanumérique
      if (!/[a-zA-Z0-9]/.test(sanitized)) {
        issues.push(
          `${fieldName} must contain at least one alphanumeric character`,
        );
      }
    }

    // Détecter mots suspicieux
    const suspiciousWords = detectSuspiciousWords(sanitized);
    if (suspiciousWords.length > 0) {
      issues.push(
        `${fieldName} contains suspicious words: ${suspiciousWords.join(', ')}`,
      );
    }

    return {
      success: sanitized.length >= 2,
      sanitized: sanitized.trim(),
      issues,
      originalLength,
      sanitizedLength: sanitized.length,
      suspiciousWords,
    };
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'order_sanitizer',
        operation: 'sanitize_account_info',
      },
      extra: { fieldName, originalValue: accountInfo?.substring(0, 50) },
    });

    return {
      success: false,
      sanitized: '',
      issues: [`${fieldName} sanitization error occurred`],
      originalLength: accountInfo?.length || 0,
      sanitizedLength: 0,
    };
  }
}

// =============================
// FONCTION PRINCIPALE DE SANITIZATION
// =============================

/**
 * Sanitize complet des données de commande
 * @param {Object} orderData - Données de commande à sanitizer
 * @returns {Object} Résultat complet de sanitization
 */
export function sanitizeOrderData(orderData) {
  const startTime = performance.now();

  try {
    if (!orderData || typeof orderData !== 'object') {
      return {
        success: false,
        sanitized: null,
        issues: ['Order data is empty or invalid'],
        summary: { totalIssues: 1, criticalIssues: 1 },
        performance: { duration: performance.now() - startTime },
      };
    }

    const results = {
      lastName: sanitizeName(orderData.lastName, 'lastName'),
      firstName: sanitizeName(orderData.firstName, 'firstName'),
      email: sanitizeEmail(orderData.email),
      phone: sanitizePhone(orderData.phone),
      paymentMethod: sanitizeUuid(orderData.paymentMethod, 'paymentMethod'),
      accountName: sanitizeAccountInfo(orderData.accountName, 'accountName'),
      accountNumber: sanitizeAccountInfo(
        orderData.accountNumber,
        'accountNumber',
      ),
      applicationId: sanitizeUuid(orderData.applicationId, 'applicationId'),
    };

    // Traitement spécial pour applicationFee (nombre)
    let applicationFee = 0;
    const applicationFeeIssues = [];

    if (typeof orderData.applicationFee === 'number') {
      if (orderData.applicationFee > 0 && orderData.applicationFee <= 1000000) {
        applicationFee = Math.floor(orderData.applicationFee);
      } else {
        applicationFeeIssues.push('Application fee out of valid range');
      }
    } else if (typeof orderData.applicationFee === 'string') {
      const parsed = parseFloat(orderData.applicationFee);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1000000) {
        applicationFee = Math.floor(parsed);
      } else {
        applicationFeeIssues.push(
          'Application fee could not be parsed or is invalid',
        );
      }
    } else {
      applicationFeeIssues.push('Application fee is not a valid number');
    }

    results.applicationFee = {
      success: applicationFee > 0,
      sanitized: applicationFee,
      issues: applicationFeeIssues,
      originalValue: orderData.applicationFee,
    };

    // Analyser les résultats globaux
    const allSuccessful = Object.values(results).every(
      (result) => result.success,
    );
    const allIssues = Object.values(results).flatMap(
      (result) => result.issues || [],
    );
    const criticalIssues = allIssues.filter(
      (issue) =>
        issue.includes('error') ||
        issue.includes('invalid') ||
        issue.includes('suspicious'),
    );

    // Créer l'objet de données sanitisées
    const sanitizedData = allSuccessful
      ? {
          lastName: results.lastName.sanitized,
          firstName: results.firstName.sanitized,
          email: results.email.sanitized,
          phone: results.phone.sanitized,
          paymentMethod: results.paymentMethod.sanitized,
          accountName: results.accountName.sanitized,
          accountNumber: results.accountNumber.sanitized,
          applicationId: results.applicationId.sanitized,
          applicationFee: results.applicationFee.sanitized,
        }
      : null;

    const duration = performance.now() - startTime;

    // Log des issues importantes
    if (criticalIssues.length > 0) {
      captureMessage('Order data sanitization found critical issues', {
        level: 'warning',
        tags: {
          component: 'order_sanitizer',
          operation: 'sanitize_order_data',
        },
        extra: {
          criticalIssues: criticalIssues.slice(0, 10), // Limiter pour éviter spam
          totalIssues: allIssues.length,
          duration,
          fieldsWithIssues: Object.entries(results)
            .filter(([_, result]) => result.issues && result.issues.length > 0)
            .map(([field, _]) => field),
        },
      });
    }

    return {
      success: allSuccessful,
      sanitized: sanitizedData,
      results,
      issues: allIssues,
      summary: {
        totalFields: Object.keys(results).length,
        successfulFields: Object.values(results).filter((r) => r.success)
          .length,
        totalIssues: allIssues.length,
        criticalIssues: criticalIssues.length,
        suspiciousWords: Object.values(results)
          .filter((r) => r.suspiciousWords)
          .flatMap((r) => r.suspiciousWords),
      },
      performance: {
        duration,
        performanceGrade:
          duration < 10 ? 'excellent' : duration < 50 ? 'good' : 'slow',
      },
    };
  } catch (error) {
    const duration = performance.now() - startTime;

    captureException(error, {
      tags: { component: 'order_sanitizer', operation: 'sanitize_order_data' },
      extra: {
        duration,
        dataKeys: orderData ? Object.keys(orderData) : [],
      },
    });

    return {
      success: false,
      sanitized: null,
      issues: ['Critical sanitization error occurred'],
      summary: { totalIssues: 1, criticalIssues: 1 },
      performance: { duration, performanceGrade: 'error' },
      error: error.message,
    };
  }
}

// =============================
// FONCTIONS UTILITAIRES
// =============================

/**
 * Vérifie si les données sanitisées sont sûres pour la base de données
 * @param {Object} sanitizedData - Données sanitisées
 * @returns {Object} Résultat de la vérification de sécurité
 */
export function validateSanitizedDataSafety(sanitizedData) {
  if (!sanitizedData) {
    return {
      safe: false,
      issues: ['No sanitized data provided'],
      recommendations: ['Perform sanitization first'],
    };
  }

  const issues = [];
  const recommendations = [];

  // Vérifier chaque champ
  Object.entries(sanitizedData).forEach(([field, value]) => {
    if (!value || (typeof value === 'string' && value.length === 0)) {
      issues.push(`${field} is empty after sanitization`);
      recommendations.push(`Review ${field} validation rules`);
    }

    // Vérifications spéciales
    if (field === 'email' && value && !value.includes('@')) {
      issues.push('Email format invalid after sanitization');
    }

    if (
      field === 'applicationFee' &&
      (typeof value !== 'number' || value <= 0)
    ) {
      issues.push('Application fee invalid after sanitization');
    }
  });

  return {
    safe: issues.length === 0,
    issues,
    recommendations,
    fieldsCount: Object.keys(sanitizedData).length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Génère un rapport de sanitization pour les logs
 * @param {Object} sanitizationResult - Résultat de sanitization
 * @returns {string} Rapport formaté
 */
export function generateSanitizationReport(sanitizationResult) {
  if (!sanitizationResult) {
    return 'No sanitization result provided';
  }

  const { success, summary, performance, issues } = sanitizationResult;

  const report = [
    `Sanitization ${success ? 'SUCCESS' : 'FAILED'}`,
    `Fields: ${summary?.successfulFields || 0}/${summary?.totalFields || 0}`,
    `Issues: ${summary?.totalIssues || 0} (${summary?.criticalIssues || 0} critical)`,
    `Performance: ${performance?.duration?.toFixed(2) || 0}ms (${performance?.performanceGrade || 'unknown'})`,
  ];

  if (summary?.suspiciousWords && summary.suspiciousWords.length > 0) {
    report.push(
      `Suspicious words: ${summary.suspiciousWords.slice(0, 5).join(', ')}`,
    );
  }

  if (issues && issues.length > 0) {
    report.push(`Top issues: ${issues.slice(0, 3).join('; ')}`);
  }

  return report.join(' | ');
}

/**
 * Formate les erreurs de sanitization pour l'utilisateur final
 * @param {Array} issues - Liste des problèmes détectés
 * @returns {string} Message d'erreur formaté pour l'utilisateur
 */
export function formatSanitizationErrorsForUser(issues) {
  if (!issues || !Array.isArray(issues) || issues.length === 0) {
    return 'Les données soumises contiennent des erreurs.';
  }

  // Mapper les erreurs techniques vers des messages utilisateur
  const userFriendlyMessages = {
    'contains suspicious words':
      'Certaines informations saisies semblent suspectes.',
    'format is invalid': 'Le format de certaines informations est incorrect.',
    'truncated to': 'Certaines informations sont trop longues.',
    'contained unauthorized characters':
      'Certains caractères ne sont pas autorisés.',
    'insufficient digits': 'Le numéro de téléphone est trop court.',
    'too many digits': 'Le numéro de téléphone est trop long.',
    'temporary/disposable':
      'Les adresses email temporaires ne sont pas acceptées.',
    'default/empty UUID': 'Veuillez sélectionner une option valide.',
    'suspicious patterns': 'Les informations de compte semblent invalides.',
    'out of valid range': "Le montant spécifié n'est pas valide.",
  };

  // Trouver le message le plus approprié
  for (const [pattern, message] of Object.entries(userFriendlyMessages)) {
    if (issues.some((issue) => issue.toLowerCase().includes(pattern))) {
      return message;
    }
  }

  // Message générique si aucun pattern spécifique trouvé
  return 'Veuillez vérifier les informations saisies et réessayer.';
}

/**
 * Crée un hash sécurisé des données sensibles pour les logs
 * @param {Object} sensitiveData - Données sensibles à hasher
 * @returns {Object} Données avec hash pour logs sécurisés
 */
export function createSecureLogHash(sensitiveData) {
  if (!sensitiveData || typeof sensitiveData !== 'object') {
    return { hash: 'invalid-data', timestamp: Date.now() };
  }

  try {
    // Créer un hash simple des données sensibles (pour logs uniquement)
    const dataString = JSON.stringify({
      email: sensitiveData.email
        ? `${sensitiveData.email[0]}***@${sensitiveData.email.split('@')[1]}`
        : null,
      phone: sensitiveData.phone
        ? `${sensitiveData.phone.substring(0, 3)}***${sensitiveData.phone.slice(-2)}`
        : null,
      accountNumber: sensitiveData.accountNumber
        ? `***${sensitiveData.accountNumber.slice(-3)}`
        : null,
      applicationId: sensitiveData.applicationId || null,
      applicationFee: sensitiveData.applicationFee || null,
    });

    // Hash simple pour identification
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
      const char = dataString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return {
      hash: Math.abs(hash).toString(16),
      timestamp: Date.now(),
      fieldsCount: Object.keys(sensitiveData).length,
    };
  } catch (error) {
    return {
      hash: 'hash-error',
      timestamp: Date.now(),
      error: error.message,
    };
  }
}

// =============================
// FONCTIONS DE VALIDATION POST-SANITIZATION
// =============================

/**
 * Valide que les données sanitisées respectent les contraintes métier
 * @param {Object} sanitizedData - Données sanitisées
 * @returns {Object} Résultat de validation métier
 */
export function validateBusinessRules(sanitizedData) {
  const violations = [];
  const warnings = [];

  if (!sanitizedData) {
    return {
      valid: false,
      violations: ['No sanitized data provided'],
      warnings: [],
    };
  }

  // Règle 1: Vérifier cohérence nom/prénom
  if (sanitizedData.lastName && sanitizedData.firstName) {
    if (
      sanitizedData.lastName.toLowerCase() ===
      sanitizedData.firstName.toLowerCase()
    ) {
      warnings.push('Nom et prénom identiques');
    }
  }

  // Règle 2: Vérifier cohérence email/nom
  if (sanitizedData.email && sanitizedData.firstName) {
    const emailLocalPart = sanitizedData.email.split('@')[0].toLowerCase();
    const firstName = sanitizedData.firstName.toLowerCase();

    // Si l'email contient le prénom, c'est bon signe
    if (
      emailLocalPart.includes(firstName) ||
      firstName.includes(emailLocalPart.substring(0, 3))
    ) {
      // Email cohérent avec le prénom
    } else if (
      emailLocalPart.includes('admin') ||
      emailLocalPart.includes('test')
    ) {
      warnings.push('Email suspect (admin/test)');
    }
  }

  // Règle 3: Vérifier montant réaliste
  if (sanitizedData.applicationFee) {
    if (sanitizedData.applicationFee < 10) {
      warnings.push('Montant très faible');
    } else if (sanitizedData.applicationFee > 100000) {
      warnings.push('Montant très élevé');
    }
  }

  // Règle 4: Vérifier format téléphone selon région
  if (sanitizedData.phone) {
    const phoneDigits = sanitizedData.phone.replace(/\D/g, '');

    if (phoneDigits.startsWith('00')) {
      // Format international
      if (phoneDigits.length < 11) {
        violations.push('Numéro international trop court');
      }
    } else if (phoneDigits.length === 8) {
      // Format local probable
      // OK
    } else if (phoneDigits.length < 8) {
      violations.push('Numéro de téléphone trop court');
    }
  }

  // Règle 5: Vérifier nom du compte vs numéro du compte
  if (sanitizedData.accountName && sanitizedData.accountNumber) {
    if (
      sanitizedData.accountName.toLowerCase() ===
      sanitizedData.accountNumber.toLowerCase()
    ) {
      violations.push('Nom et numéro de compte identiques');
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings,
    rulesPassed: 5 - violations.length,
    totalRules: 5,
  };
}

/**
 * Fonction de pré-validation rapide avant sanitization complète
 * @param {Object} rawData - Données brutes à vérifier rapidement
 * @returns {Object} Résultat de pré-validation
 */
export function preValidateOrderData(rawData) {
  const issues = [];
  const critical = [];

  if (!rawData || typeof rawData !== 'object') {
    return {
      passed: false,
      issues: ['No data provided'],
      critical: ['No data provided'],
      canProceed: false,
    };
  }

  // Vérifications rapides
  const requiredFields = [
    'lastName',
    'firstName',
    'email',
    'phone',
    'paymentMethod',
    'accountName',
    'accountNumber',
    'applicationId',
    'applicationFee',
  ];

  requiredFields.forEach((field) => {
    if (
      !rawData[field] ||
      (typeof rawData[field] === 'string' && rawData[field].trim().length === 0)
    ) {
      critical.push(`Missing required field: ${field}`);
    }
  });

  // Vérifications de sécurité rapides
  Object.entries(rawData).forEach(([field, value]) => {
    if (typeof value === 'string') {
      // Vérifier longueur excessive
      if (value.length > 1000) {
        critical.push(`${field} is excessively long`);
      }

      // Vérifier patterns dangereux évidents
      if (/<script|javascript:|onload=|onerror=/i.test(value)) {
        critical.push(`${field} contains dangerous script patterns`);
      }

      // Vérifier SQL injection évidente
      if (/(\bDROP\b|\bDELETE\b|\bUNION\b.*\bSELECT\b)/i.test(value)) {
        critical.push(`${field} contains SQL injection patterns`);
      }
    }
  });

  // Vérification email basique
  if (rawData.email && typeof rawData.email === 'string') {
    if (!rawData.email.includes('@') || !rawData.email.includes('.')) {
      issues.push('Email format appears invalid');
    }
  }

  // Vérification téléphone basique
  if (rawData.phone && typeof rawData.phone === 'string') {
    const phoneDigits = rawData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 6) {
      issues.push('Phone number appears too short');
    }
  }

  return {
    passed: critical.length === 0,
    issues,
    critical,
    canProceed: critical.length === 0,
    summary: {
      totalFields: Object.keys(rawData).length,
      requiredFieldsMissing: requiredFields.filter((f) => !rawData[f]).length,
      criticalIssues: critical.length,
      minorIssues: issues.length,
    },
  };
}

// =============================
// EXPORTS PRINCIPAUX
// =============================

export default {
  // Fonction principale
  sanitizeOrderData,

  // Fonctions spécialisées
  sanitizeName,
  sanitizeEmail,
  sanitizePhone,
  sanitizeUuid,
  sanitizeAccountInfo,

  // Validations
  validateBusinessRules,
  validateSanitizedDataSafety,
  preValidateOrderData,

  // Utilitaires
  generateSanitizationReport,
  formatSanitizationErrorsForUser,
  createSecureLogHash,

  // Configuration
  SANITIZER_CONFIG,
};
