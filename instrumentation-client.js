// instrumentation-client.js
// Configuration Sentry client simplifiée - Erreurs uniquement
// Next.js 15 - Version minimale pour 500 visiteurs/jour

import * as Sentry from '@sentry/nextjs';
import { containsSensitiveData, filterMessage } from './utils/sentry-utils.js';

const sentryDSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';

if (sentryDSN && isValidDSN(sentryDSN)) {
  Sentry.init({
    dsn: sentryDSN,
    environment,
    release: process.env.SENTRY_RELEASE || '1.0.0',

    // Configuration minimale client
    debug: !isProduction,
    enabled: true, // Actif même en dev pour tester

    // PAS de performance monitoring
    tracesSampleRate: 0,

    // PAS de session replay
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Intégrations minimales - AUCUNE
    integrations: [
      // Pas de browserTracingIntegration
      // Pas de replayIntegration
    ],

    // Erreurs client communes à ignorer
    ignoreErrors: [
      // Erreurs navigateur courantes
      'Non-Error promise rejection captured',
      'Script error',
      'Non-Error exception captured',

      // Extensions navigateur
      'chrome-extension',
      'safari-extension',
      'moz-extension',

      // Erreurs réseau client
      'Network request failed',
      'Failed to fetch',
      'NetworkError',
      'AbortError',
      'TypeError: Failed to fetch',

      // Erreurs Next.js/React client
      'ChunkLoadError',
      'Loading chunk',
      'ResizeObserver loop limit exceeded',

      // CSP et sécurité
      'Content Security Policy',
      'violated directive',
    ],

    // URLs à ignorer
    denyUrls: [
      // Extensions
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
      /^safari-extension:\/\//i,

      // Services tiers
      /googletagmanager\.com/i,
      /analytics\.google\.com/i,
      /facebook\.net/i,
    ],

    // Filtrage basique des breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Filtrer les requêtes sensibles
      if (['xhr', 'fetch'].includes(breadcrumb.category) && breadcrumb.data) {
        if (breadcrumb.data.url) {
          const url = breadcrumb.data.url;
          if (
            url.includes('/contact') ||
            url.includes('/order') ||
            url.includes('/api/')
          ) {
            return null; // Ignorer complètement
          }
        }

        // Filtrer les données sensibles dans le body
        if (
          breadcrumb.data.body &&
          containsSensitiveData(breadcrumb.data.body)
        ) {
          breadcrumb.data.body = '[FILTERED]';
        }
      }

      // Filtrer les logs console sensibles
      if (breadcrumb.category === 'console' && breadcrumb.message) {
        if (containsSensitiveData(breadcrumb.message)) {
          return null;
        }
      }

      return breadcrumb;
    },

    // Filtrage basique des événements
    beforeSend(event) {
      // Ne pas envoyer les erreurs des pages sensibles
      if (
        event.request?.url?.includes('/contact') ||
        event.request?.url?.includes('/order') ||
        window?.location?.pathname?.includes('/contact') ||
        window?.location?.pathname?.includes('/order')
      ) {
        return null;
      }

      // Filtrer les messages sensibles
      if (event.message && containsSensitiveData(event.message)) {
        event.message = filterMessage(event.message);
      }

      // Tags basiques client
      event.tags = {
        ...event.tags,
        project: 'benew-client',
        runtime: 'browser',
      };

      return event;
    },
  });

  console.log('✅ Sentry client initialized (errors only)');
} else {
  console.warn('⚠️ Sentry client: Invalid or missing DSN');
}

// =============================================
// UTILITAIRES
// =============================================

function isValidDSN(dsn) {
  if (!dsn) return false;
  return /^https:\/\/[^@]+@[^/]+\/\d+$/.test(dsn);
}

// Export pour navigation (optionnel)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
