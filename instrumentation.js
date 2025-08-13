// instrumentation.js
// Configuration Sentry v10 simplifiée - Erreurs uniquement
// Next.js 15 - Configuration minimale pour 500 visiteurs/jour

import * as Sentry from '@sentry/nextjs';
import { containsSensitiveData, filterMessage } from './utils/sentry-utils.js';

// =============================================
// CONFIGURATION SYSTÈME NEXT.JS 15
// =============================================

export async function register() {
  // Import conditionnel selon l'environnement
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🔧 Loading Sentry server configuration...');
    await initSentryServer();
  }

  console.log('✅ Sentry instrumentation registered');
}

// =============================================
// HOOK NEXT.JS 15 - ERREURS DE REQUÊTE
// =============================================

export const onRequestError = Sentry.captureRequestError;

// =============================================
// CONFIGURATION SERVEUR SIMPLIFIÉE
// =============================================

function initSentryServer() {
  const sentryDSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';
  const isProduction = environment === 'production';

  if (!sentryDSN || !isValidDSN(sentryDSN)) {
    console.warn('⚠️ Sentry: Invalid or missing DSN');
    return;
  }

  Sentry.init({
    dsn: sentryDSN,
    environment,
    release: process.env.SENTRY_RELEASE || '1.0.0',

    // Configuration minimale - erreurs uniquement
    debug: !isProduction,
    enabled: isProduction,

    // PAS de performance monitoring
    tracesSampleRate: 0,
    profilesSampleRate: 0,

    // PAS de session replay
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Intégrations minimales
    integrations: [
      // Pas de browserTracingIntegration
      // Pas de replayIntegration
    ],

    // Erreurs communes à ignorer
    ignoreErrors: [
      // Erreurs réseau courantes
      'Network request failed',
      'Failed to fetch',
      'NetworkError',
      'AbortError',

      // Erreurs Next.js courantes
      'NEXT_REDIRECT',
      'NEXT_NOT_FOUND',
      'ChunkLoadError',

      // Extensions navigateur
      'Script error',
      'Non-Error promise rejection captured',
      'chrome-extension',
      'moz-extension',
    ],

    // Filtrage basique des breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Filtrer les requêtes sensibles
      if (
        ['xhr', 'fetch'].includes(breadcrumb.category) &&
        breadcrumb.data?.url
      ) {
        const url = breadcrumb.data.url;
        if (url.includes('/api/contact') || url.includes('/api/order')) {
          return null; // Ignorer complètement
        }

        // Filtrer les données sensibles dans le body
        if (
          breadcrumb.data.body &&
          containsSensitiveData(breadcrumb.data.body)
        ) {
          breadcrumb.data.body = '[FILTERED]';
        }
      }

      return breadcrumb;
    },

    // Filtrage basique des événements
    beforeSend(event) {
      // Ne pas envoyer les erreurs des routes sensibles
      if (event.request?.url) {
        const url = event.request.url;
        if (url.includes('/api/contact') || url.includes('/api/order')) {
          return null;
        }
      }

      // Filtrer les messages sensibles
      if (event.message && containsSensitiveData(event.message)) {
        event.message = filterMessage(event.message);
      }

      // Tags basiques
      event.tags = {
        ...event.tags,
        project: 'benew-client',
        runtime: 'nodejs',
      };

      return event;
    },
  });

  console.log('✅ Sentry server initialized (errors only)');
}

// =============================================
// API DÉVELOPPEUR SIMPLIFIÉE
// =============================================

/**
 * Capture une exception simple
 * @param {Error} error - L'erreur à capturer
 * @param {Object} context - Contexte optionnel
 */
export const captureException = (error, context = {}) => {
  Sentry.withScope((scope) => {
    // Tags basiques
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    // Niveau d'erreur
    if (context.level) {
      scope.setLevel(context.level);
    }

    Sentry.captureException(error);
  });
};

/**
 * Capture un message simple
 * @param {string} message - Le message à capturer
 * @param {string} level - Niveau du message
 */
export const captureMessage = (message, level = 'info') => {
  const filteredMessage = containsSensitiveData(message)
    ? filterMessage(message)
    : message;

  Sentry.captureMessage(filteredMessage, level);
};

/**
 * Définir un utilisateur (version anonyme)
 * @param {Object} user - Données utilisateur
 */
export const setUser = (user) => {
  if (!user) {
    Sentry.setUser(null);
    return;
  }

  // Version ultra-simplifiée - juste un ID anonyme
  Sentry.setUser({
    id: user.id || 'anonymous',
    type: 'visitor',
  });
};

// =============================================
// UTILITAIRES
// =============================================

function isValidDSN(dsn) {
  if (!dsn) return false;
  return /^https:\/\/[^@]+@[^/]+\/\d+$/.test(dsn);
}
