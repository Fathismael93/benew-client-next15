// instrumentation-client.js
// Configuration Sentry pour l'environnement client (navigateur)
// Next.js 15 + Framer Motion + SCSS

import * as Sentry from '@sentry/nextjs';

function isValidDSN(dsn) {
  if (!dsn) return false;
  return /^https:\/\/[^@]+@[^/]+\/\d+$/.test(dsn);
}

// Fonctions utilitaires client (simplifiées pour le bundle)
function containsSensitiveDataClient(str) {
  if (!str || typeof str !== 'string') return false;

  const patterns = [
    /password/i,
    /token/i,
    /secret/i,
    /api[_-]?key/i,
    /email[=:]\s*[^\s@]+@[^\s]+/gi,
    /\b(?:\d{4}[ -]?){3}\d{4}\b/, // Numéros de carte
  ];

  return patterns.some((pattern) => pattern.test(str));
}

function anonymizeUserDataClient(userData) {
  if (!userData) return userData;

  const anonymized = { ...userData };

  // Supprimer données très sensibles
  delete anonymized.ip_address;
  delete anonymized.account_number;
  delete anonymized.payment_method;

  // Anonymiser email
  if (anonymized.email) {
    const email = anonymized.email;
    const atIndex = email.indexOf('@');
    if (atIndex > 0) {
      const domain = email.slice(atIndex);
      anonymized.email = `${email[0]}***${domain}`;
    } else {
      anonymized.email = '[FILTERED_EMAIL]';
    }
  }

  // Anonymiser nom
  if (anonymized.firstName) {
    anonymized.firstName = anonymized.firstName[0] + '***';
  }
  if (anonymized.lastName) {
    anonymized.lastName = anonymized.lastName[0] + '***';
  }

  // Anonymiser téléphone
  if (anonymized.phone) {
    const phone = anonymized.phone;
    anonymized.phone =
      phone.length > 4
        ? phone.substring(0, 2) + '***' + phone.slice(-2)
        : '[PHONE]';
  }

  return anonymized;
}

const sentryDSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';

if (sentryDSN && isValidDSN(sentryDSN)) {
  Sentry.init({
    dsn: sentryDSN,
    environment,
    release: process.env.SENTRY_RELEASE || '1.0.0',
    debug: !isProduction,
    enabled: true, // Toujours actif côté client pour debugging

    // Configuration client optimisée
    tracesSampleRate: isProduction ? 0.1 : 1.0,

    // ✅ CORRECTION 2: Configuration enableLogs v9 côté client
    enableLogs: true,

    // Session Replay v9 - Configuration moderne
    replaysSessionSampleRate: isProduction ? 0.1 : 0.5,
    replaysOnErrorSampleRate: 1.0,

    // Intégrations v9 modernes
    integrations: [
      Sentry.browserTracingIntegration({
        // Configuration du tracing navigateur
        enableInp: true, // Core Web Vitals
      }),
      Sentry.replayIntegration({
        // Configuration Session Replay sécurisée
        maskAllText: true,
        blockAllMedia: true,
        maskAllInputs: true,
        blockClass: 'sentry-block',
        maskClass: 'sentry-mask',
        blockSelector:
          '.payment-input, .contact-form, .order-form, .sensitive-data',
      }),
    ],

    // Propagation pour API calls
    tracePropagationTargets: [
      'localhost',
      /^\/api\//,
      process.env.NEXT_PUBLIC_SITE_URL,
    ],

    // Erreurs à ignorer côté client
    ignoreErrors: [
      // Erreurs navigateur communes
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

      // Erreurs React/Next.js client
      'ChunkLoadError',
      'Loading chunk',
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',

      // Erreurs Framer Motion
      'Animation interrupted',
      'Gesture cancelled',

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
      /connect\.facebook\.net/i,
    ],

    beforeBreadcrumb(breadcrumb, hint) {
      // Filtrer breadcrumbs client
      if (['xhr', 'fetch'].includes(breadcrumb.category) && breadcrumb.data) {
        if (breadcrumb.data.url) {
          // Masquer URLs sensibles côté client
          if (
            breadcrumb.data.url.includes('/contact') ||
            breadcrumb.data.url.includes('/order') ||
            breadcrumb.data.url.includes('/api/') ||
            breadcrumb.data.url.includes('password') ||
            breadcrumb.data.url.includes('token')
          ) {
            breadcrumb.data.url = '[Filtered Client URL]';
          }
        }

        if (
          breadcrumb.data.body &&
          containsSensitiveDataClient(breadcrumb.data.body)
        ) {
          breadcrumb.data.body = '[CLIENT_DATA_FILTERED]';
        }
      }

      // Filtrer logs console client
      if (breadcrumb.category === 'console' && breadcrumb.message) {
        if (containsSensitiveDataClient(breadcrumb.message)) {
          breadcrumb.message =
            '[Log client filtré contenant des données sensibles]';
        }
      }

      return breadcrumb;
    },

    beforeSend(event, hint) {
      // Ne pas envoyer événements des pages sensibles côté client
      if (
        event.request?.url?.includes('/contact') ||
        event.request?.url?.includes('/order') ||
        event.request?.url?.includes('/templates') ||
        window?.location?.pathname?.includes('/contact') ||
        window?.location?.pathname?.includes('/order')
      ) {
        return null;
      }

      // Catégorisation erreurs client
      const error = hint && hint.originalException;
      if (error) {
        event.tags = event.tags || {};

        // Catégories spécifiques client
        const message = error.message || '';
        if (/network|fetch|http/i.test(message)) {
          event.tags.error_category = 'client_network';
        } else if (/framer|motion|animation/i.test(message)) {
          event.tags.error_category = 'client_animation';
        } else if (/chunk|loading/i.test(message)) {
          event.tags.error_category = 'client_loading';
        } else {
          event.tags.error_category = 'client_application';
        }

        // Type de page client
        if (typeof window !== 'undefined') {
          const path = window.location.pathname;
          if (path.includes('/blog/')) {
            event.tags.page_type = 'blog';
          } else if (path.includes('/templates/')) {
            event.tags.page_type = 'templates';
          } else if (path === '/') {
            event.tags.page_type = 'homepage';
          }
        }
      }

      // Anonymisation utilisateur client
      if (event.user) {
        event.user = anonymizeUserDataClient(event.user);
      }

      // Filtrer message client
      if (event.message && containsSensitiveDataClient(event.message)) {
        event.message = `[Message client filtré] ${event.message.substring(0, 50)}...`;
      }

      // Tags client
      event.tags = {
        ...event.tags,
        project: 'benew-client',
        stack: 'nextjs15-client-framer-motion',
        runtime: 'browser',
      };

      return event;
    },
  });

  console.log('✅ Sentry client initialized successfully');
} else {
  console.warn('⚠️ Sentry client: Invalid or missing DSN');
}

// Export pour navigation tracing v9
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
