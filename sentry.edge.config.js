// sentry.edge.config.js
// Configuration Sentry pour l'environnement Edge Runtime
// Next.js 15 - Middlewares et Edge API Routes

import * as Sentry from '@sentry/nextjs';

function isValidDSN(dsn) {
  if (!dsn) return false;
  return /^https:\/\/[^@]+@[^/]+\/\d+$/.test(dsn);
}

// Fonctions utilitaires simplifiées pour Edge (pas d'imports externes)
function containsSensitiveDataEdge(str) {
  if (!str || typeof str !== 'string') return false;

  const patterns = [
    /password/i,
    /token/i,
    /secret/i,
    /api[_-]?key/i,
    /cloudinary[_-]?api[_-]?secret/i,
    /account[_-]?number/i,
    /\b(?:\d{4}[ -]?){3}\d{4}\b/, // Numéros de carte
    /\b(?:\d{3}[ -]?){2}\d{4}\b/, // Numéros de téléphone
  ];

  return patterns.some((pattern) => pattern.test(str));
}

function anonymizeUrlEdge(url) {
  if (!url) return url;

  try {
    const urlObj = new URL(url);
    const sensitiveParams = [
      'token',
      'password',
      'key',
      'secret',
      'auth',
      'api_key',
    ];

    let hasFiltered = false;
    sensitiveParams.forEach((param) => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[FILTERED]');
        hasFiltered = true;
      }
    });

    return hasFiltered ? urlObj.toString() : url;
  } catch (e) {
    return '[URL_PARSING_ERROR]';
  }
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

    // Configuration Edge spécifique - plus conservative
    tracesSampleRate: isProduction ? 0.05 : 1.0, // Plus bas pour Edge
    profilesSampleRate: 0, // Pas de profiling en Edge

    // Erreurs à ignorer spécifiques à Edge
    ignoreErrors: [
      // Erreurs Edge Runtime
      'Edge function timeout',
      'Runtime not available',
      'Middleware error',

      // Erreurs réseau Edge
      'Network request failed',
      'Failed to fetch',
      'NetworkError',
      'AbortError',

      // Next.js Edge
      'NEXT_REDIRECT',
      'NEXT_NOT_FOUND',
    ],

    beforeBreadcrumb(breadcrumb, hint) {
      // Filtrage minimal pour Edge (performance critique)
      if (['xhr', 'fetch'].includes(breadcrumb.category) && breadcrumb.data) {
        if (breadcrumb.data.url) {
          breadcrumb.data.url = anonymizeUrlEdge(breadcrumb.data.url);
        }

        if (
          breadcrumb.data.body &&
          containsSensitiveDataEdge(breadcrumb.data.body)
        ) {
          breadcrumb.data.body = '[FILTERED_EDGE]';
        }
      }

      return breadcrumb;
    },

    beforeSend(event, hint) {
      // Filtrage ultra-rapide pour Edge
      if (event.request?.url?.includes('/api/sensitive')) {
        return null;
      }

      // Anonymisation rapide
      if (event.request && event.request.url) {
        event.request.url = anonymizeUrlEdge(event.request.url);
      }

      if (event.request && event.request.headers) {
        // Filtrer headers sensibles rapidement
        const sensitiveHeaders = ['authorization', 'cookie', 'x-auth-token'];
        const headers = { ...event.request.headers };

        sensitiveHeaders.forEach((header) => {
          if (headers[header]) {
            headers[header] = '[FILTERED]';
          }
        });

        event.request.headers = headers;
      }

      if (event.message && containsSensitiveDataEdge(event.message)) {
        event.message = `[Edge message filtered] ${event.message.substring(0, 30)}...`;
      }

      // Tags Edge
      event.tags = {
        ...event.tags,
        project: 'benew-client',
        runtime: 'edge',
      };

      return event;
    },
  });

  console.log('✅ Sentry edge initialized successfully');
} else {
  console.warn('⚠️ Sentry edge: Invalid or missing DSN');
}
