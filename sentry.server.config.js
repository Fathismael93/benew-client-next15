// sentry.server.config.js
// Configuration Sentry pour l'environnement serveur Node.js
// Next.js 15 + PostgreSQL + Cloudinary + EmailJS

import * as Sentry from '@sentry/nextjs';
import {
  containsSensitiveData,
  categorizeError,
  anonymizeUserData,
  anonymizeUrl,
  anonymizeHeaders,
  filterRequestBody,
} from './utils/sentry-utils.js';

function isValidDSN(dsn) {
  if (!dsn) return false;
  return /^https:\/\/[^@]+@[^/]+\/\d+$/.test(dsn);
}

const sentryDSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const environment = process.env.NODE_ENV || 'development';
const isProduction = environment === 'production';

if (sentryDSN && isValidDSN(sentryDSN)) {
  Sentry.init({
    dsn: sentryDSN,
    environment,
    release:
      process.env.SENTRY_RELEASE ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      '1.0.0',
    debug: !isProduction,
    enabled: isProduction,

    // Configuration serveur spécifique
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    profilesSampleRate: isProduction ? 0.1 : 1.0,

    // ✅ CORRECTION 2: Configuration enableLogs v9
    enableLogs: true,

    // Logs expérimentaux v9 (optionnel - peut être retiré si stable)
    _experiments: {
      enableLogs: true,
    },

    // Erreurs à ignorer spécifiques au serveur
    ignoreErrors: [
      // Erreurs PostgreSQL communes
      'Connection terminated',
      'Client has encountered a connection error',
      'Connection timeout',
      'ENOTFOUND',
      'ECONNABORTED',
      'connection not available',

      // Erreurs Next.js serveur
      'NEXT_REDIRECT',
      'NEXT_NOT_FOUND',
      'Route cancelled',

      // Erreurs réseau serveur
      'ECONNREFUSED',
      'ECONNRESET',
      'socket hang up',
      'ETIMEDOUT',
      'read ECONNRESET',
      'connect ETIMEDOUT',

      // Erreurs Cloudinary serveur
      'Upload failed',
      'Resource not found',
      'Invalid signature',
      'Transformation failed',
      'Upload timeout',

      // Erreurs de validation côté serveur
      'ValidationError',
      'yup validation error',
    ],

    beforeBreadcrumb(breadcrumb, hint) {
      // Filtrer les breadcrumbs serveur sensibles
      if (['xhr', 'fetch'].includes(breadcrumb.category) && breadcrumb.data) {
        if (breadcrumb.data.url) {
          breadcrumb.data.url = anonymizeUrl(breadcrumb.data.url);
        }

        if (breadcrumb.data.body) {
          breadcrumb.data.body = filterRequestBody(breadcrumb.data.body);
        }

        if (breadcrumb.data.response_headers) {
          breadcrumb.data.response_headers = anonymizeHeaders(
            breadcrumb.data.response_headers,
          );
        }
      }

      // Filtrer les logs serveur
      if (breadcrumb.category === 'console' && breadcrumb.message) {
        if (containsSensitiveData(breadcrumb.message)) {
          breadcrumb.message =
            '[Log serveur filtré contenant des données sensibles]';
        }
      }

      return breadcrumb;
    },

    beforeSend(event, hint) {
      const error = hint && hint.originalException;

      // Ne pas envoyer d'événements pour les routes sensibles
      if (
        event.request?.url?.includes('/api/contact') ||
        event.request?.url?.includes('/api/order') ||
        event.request?.url?.includes('/api/templates') ||
        event.request?.url?.includes('/api/cloudinary') ||
        event.request?.url?.includes('/api/email')
      ) {
        return null;
      }

      // Catégorisation des erreurs serveur
      if (error) {
        event.tags = event.tags || {};
        event.tags.error_category = categorizeError(error);
        event.tags.runtime = 'nodejs';

        // Tags spécifiques au contexte serveur
        if (event.request && event.request.url) {
          const url = event.request.url;
          if (url.includes('/api/')) {
            event.tags.page_type = 'api';
          } else if (url.includes('/blog/')) {
            event.tags.page_type = 'blog';
          } else if (url.includes('/templates/')) {
            event.tags.page_type = 'templates';
          }
        }
      }

      // Anonymisation serveur
      if (event.request && event.request.headers) {
        event.request.headers = anonymizeHeaders(event.request.headers);
      }

      if (event.request && event.request.cookies) {
        event.request.cookies = '[FILTERED]';
      }

      if (event.user) {
        event.user = anonymizeUserData(event.user);
      }

      if (event.request && event.request.url) {
        event.request.url = anonymizeUrl(event.request.url);
      }

      // Filtrer les messages d'erreur sensibles
      if (event.message && containsSensitiveData(event.message)) {
        event.message = `[Message serveur filtré] ${event.message.substring(0, 50)}...`;
      }

      // Tags spécifiques au serveur
      event.tags = {
        ...event.tags,
        project: 'benew-client',
        stack: 'nextjs15-postgres-cloudinary-emailjs',
        runtime: 'nodejs',
      };

      return event;
    },
  });

  console.log('✅ Sentry server initialized successfully');
} else {
  console.warn('⚠️ Sentry server: Invalid or missing DSN');
}
