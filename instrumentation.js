// instrumentation.js
// Configuration Sentry v9.35.0 - Architecture moderne
// Next.js 15 + PostgreSQL + Cloudinary + EmailJS

import * as Sentry from '@sentry/nextjs';
import { EventEmitter } from 'events';

// Augmenter la limite d'écouteurs d'événements pour éviter l'avertissement
if (typeof EventEmitter !== 'undefined') {
  EventEmitter.defaultMaxListeners = 25;
}

// =============================================
// CONFIGURATION SYSTÈME NEXT.JS V9
// =============================================

export async function register() {
  // Import conditionnel selon l'environnement d'exécution
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🔧 Loading Sentry server configuration...');
    await import('./sentry.server.config.js');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    console.log('🔧 Loading Sentry edge configuration...');
    await import('./sentry.edge.config.js');
  }

  console.log('✅ Sentry instrumentation registered successfully');
}

// =============================================
// ✅ CORRECTION 1: HOOK ONREQUESTERROR v9 - API MODERNE NEXT.JS 15
// =============================================

/**
 * Hook Next.js 15 pour capturer les erreurs de requête serveur
 * Compatible avec React Server Components et Server Actions
 * Utilise la nouvelle API Sentry v9
 */
export const onRequestError = Sentry.captureRequestError;

// =============================================
// API DÉVELOPPEUR - FONCTIONS UTILITAIRES
// =============================================

/**
 * Capture une exception avec des informations contextuelles pour le site Benew
 * @param {Error} error - L'erreur à capturer
 * @param {Object} context - Contexte supplémentaire sur l'erreur
 */
export const captureException = (error, context = {}) => {
  Sentry.withScope((scope) => {
    // Tags spécifiques au site Benew
    const defaultTags = {
      component: 'benew-client',
      project: 'benew-ecommerce',
      ...context.tags,
    };

    Object.entries(defaultTags).forEach(([key, value]) => {
      scope.setTag(key, value);
    });

    // Catégoriser les erreurs par type
    if (error?.message) {
      if (/postgres|pg|database|db|connection/i.test(error.message)) {
        scope.setTag('error_category', 'database');
      } else if (/cloudinary|upload|image/i.test(error.message)) {
        scope.setTag('error_category', 'media_upload');
      } else if (/emailjs|email|mail/i.test(error.message)) {
        scope.setTag('error_category', 'email_service');
      } else if (/validation|yup|schema/i.test(error.message)) {
        scope.setTag('error_category', 'validation');
      } else if (/framer|motion|animation/i.test(error.message)) {
        scope.setTag('error_category', 'animation');
      }
    }

    // Ajouter des données supplémentaires filtrées
    const filteredExtra = {};
    Object.entries(context.extra || {}).forEach(([key, value]) => {
      // Filtrer les données sensibles dans les extras
      const sensitiveKeys = [
        'password',
        'token',
        'secret',
        'api_key',
        'account_number',
        'email',
        'phone',
        'cloudinary_api_secret',
        'emailjs_user_id',
      ];

      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        filteredExtra[key] = '[Filtered]';
      } else {
        filteredExtra[key] = value;
      }
    });

    Object.entries(filteredExtra).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });

    // Définir le niveau de l'erreur
    if (context.level) {
      scope.setLevel(context.level);
    }

    // Capturer l'exception
    Sentry.captureException(error);
  });
};

/**
 * Capture un message avec des informations contextuelles pour le site Benew
 * @param {string} message - Le message à capturer
 * @param {Object} context - Contexte supplémentaire sur le message
 */
export const captureMessage = (message, context = {}) => {
  Sentry.withScope((scope) => {
    // Tags par défaut pour le site
    const defaultTags = {
      component: 'benew-client',
      project: 'benew-ecommerce',
      ...context.tags,
    };

    Object.entries(defaultTags).forEach(([key, value]) => {
      scope.setTag(key, value);
    });

    // Filtrer le message s'il contient des données sensibles
    let filteredMessage = message;
    const sensitivePatterns = [
      /password[=:]\s*[^\s]+/gi,
      /token[=:]\s*[^\s]+/gi,
      /secret[=:]\s*[^\s]+/gi,
      /account[_-]?number[=:]\s*[^\s]+/gi,
      /email[=:]\s*[^\s@]+@[^\s]+/gi,
    ];

    sensitivePatterns.forEach((pattern) => {
      filteredMessage = filteredMessage.replace(
        pattern,
        '[Filtered Sensitive Data]',
      );
    });

    // Ajouter des données supplémentaires filtrées
    Object.entries(context.extra || {}).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });

    // Définir le niveau du message
    if (context.level) {
      scope.setLevel(context.level);
    }

    // Capturer le message filtré
    Sentry.captureMessage(filteredMessage);
  });
};

/**
 * Enregistre l'utilisateur actuel dans Sentry pour le suivi des erreurs
 * @param {Object} user - Informations de l'utilisateur à enregistrer
 */
export const setUser = (user) => {
  if (!user) {
    Sentry.setUser(null);
    return;
  }

  // Anonymiser complètement les données utilisateur pour la sécurité
  function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  const anonymizedUser = {
    id: user.id || user._id || 'anonymous',
    // Anonymiser l'email avec hash
    email: user.email ? `${hashCode(user.email)}@benew.client` : undefined,
    // Type d'utilisateur
    type: 'site_visitor',
  };

  // Ne jamais envoyer d'informations personnelles identifiables
  Sentry.setUser(anonymizedUser);
};

/**
 * Capture les erreurs de base de données PostgreSQL avec contexte spécifique
 * @param {Error} error - L'erreur PostgreSQL
 * @param {Object} context - Contexte de la requête DB
 */
export const captureDatabaseError = (error, context = {}) => {
  const dbContext = {
    tags: {
      error_category: 'database',
      database_type: 'postgresql',
      ...context.tags,
    },
    extra: {
      postgres_code: error.code,
      table: context.table || 'unknown',
      operation: context.operation || 'unknown',
      query_type: context.queryType || 'unknown',
      ...context.extra,
    },
    level: 'error',
  };

  // Filtrer les informations sensibles de la DB
  if (dbContext.extra.query) {
    // Masquer les valeurs dans les requêtes SQL
    dbContext.extra.query = dbContext.extra.query.replace(
      /(password|token|secret|account_number)\s*=\s*'[^']*'/gi,
      "$1 = '[Filtered]'",
    );
  }

  captureException(error, dbContext);
};

/**
 * Capture les erreurs Cloudinary avec contexte spécifique
 * @param {Error} error - L'erreur Cloudinary
 * @param {Object} context - Contexte de l'upload
 */
export const captureCloudinaryError = (error, context = {}) => {
  const cloudinaryContext = {
    tags: {
      error_category: 'media_upload',
      service: 'cloudinary',
      ...context.tags,
    },
    extra: {
      upload_type: context.uploadType || 'unknown',
      file_size: context.fileSize || 'unknown',
      file_type: context.fileType || 'unknown',
      ...context.extra,
    },
    level: 'error',
  };

  captureException(error, cloudinaryContext);
};

/**
 * Capture les erreurs EmailJS avec contexte spécifique
 * @param {Error} error - L'erreur EmailJS
 * @param {Object} context - Contexte de l'email
 */
export const captureEmailError = (error, context = {}) => {
  const emailContext = {
    tags: {
      error_category: 'email_service',
      service: 'emailjs',
      ...context.tags,
    },
    extra: {
      email_type: context.emailType || 'contact',
      template_id: '[FILTERED]', // Ne pas exposer les IDs de template
      ...context.extra,
    },
    level: 'warning',
  };

  captureException(error, emailContext);
};

/**
 * Capture les erreurs de validation avec contexte spécifique
 * @param {Error} error - L'erreur de validation
 * @param {Object} context - Contexte de la validation
 */
export const captureValidationError = (error, context = {}) => {
  const validationContext = {
    tags: {
      error_category: 'validation',
      validation_library: 'yup',
      ...context.tags,
    },
    extra: {
      field: context.field || 'unknown',
      form: context.form || 'unknown',
      validation_type: context.validationType || 'unknown',
      ...context.extra,
    },
    level: 'info',
  };

  captureException(error, validationContext);
};

/**
 * Initialise Sentry - fonction compatible avec l'ancien code
 * @deprecated Utilisez maintenant l'architecture v9 avec register()
 */
export const initSentry = () => {
  console.log(
    '✅ Sentry init called - using modern v9 architecture with register()',
  );
};
