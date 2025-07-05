// instrumentation.js
// Configuration Sentry pour le site vitrine/ecommerce Benew
// Next.js 15 + PostgreSQL + Cloudinary + EmailJS

import * as Sentry from '@sentry/nextjs';
import { EventEmitter } from 'events';

// Augmenter la limite d'écouteurs d'événements pour éviter l'avertissement
if (typeof EventEmitter !== 'undefined') {
  EventEmitter.defaultMaxListeners = 25;
}

// =============================================
// FONCTIONS UTILITAIRES
// =============================================

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
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Conversion en 32bit integer
  }
  return Math.abs(hash).toString(16);
}

function isValidDSN(dsn) {
  if (!dsn) return false;
  return /^https:\/\/[^@]+@[^/]+\/\d+$/.test(dsn);
}

// =============================================
// CONFIGURATION SYSTÈME NEXT.JS
// =============================================

export async function register() {
  const sentryDSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';
  const isProduction = environment === 'production';

  if (sentryDSN && isValidDSN(sentryDSN)) {
    try {
      const Sentry = await import('@sentry/nextjs');

      Sentry.init({
        dsn: sentryDSN,
        environment,
        release:
          process.env.SENTRY_RELEASE ||
          process.env.VERCEL_GIT_COMMIT_SHA ||
          '1.0.0',
        debug: !isProduction,
        enabled: isProduction,

        // Configuration spécifique pour votre site vitrine
        tracesSampleRate: isProduction ? 0.1 : 1.0,
        profilesSampleRate: isProduction ? 0.1 : 1.0,

        // Intégrations spécifiques
        integrations: [
          new Sentry.Replay({
            maskAllText: true,
            blockAllMedia: true,
            maskAllInputs: true,
            blockClass: 'sentry-block',
            maskClass: 'sentry-mask',
            // Masquer les éléments sensibles du site
            blockSelector:
              '.payment-input, .contact-form, .order-form, .sensitive-data',
          }),
        ],

        // Erreurs à ignorer spécifiques à votre stack
        ignoreErrors: [
          // Erreurs réseau
          'Connection refused',
          'Connection reset',
          'ECONNREFUSED',
          'ECONNRESET',
          'socket hang up',
          'ETIMEDOUT',
          'read ECONNRESET',
          'connect ETIMEDOUT',
          'Network request failed',
          'Failed to fetch',
          'NetworkError',
          'AbortError',
          'TypeError: Failed to fetch',

          // Erreurs PostgreSQL communes
          'Connection terminated',
          'Client has encountered a connection error',
          'Connection timeout',
          'ENOTFOUND',
          'ECONNABORTED',
          'connection not available',

          // Erreurs Next.js
          'NEXT_REDIRECT',
          'NEXT_NOT_FOUND',
          'Cancelled',
          'Route cancelled',

          // Erreurs Cloudinary
          'Upload failed',
          'Resource not found',
          'Invalid signature',
          'Transformation failed',
          'Upload timeout',

          // Erreurs EmailJS
          'EmailJS error',
          'Service unavailable',
          'Template not found',
          'Invalid user ID',

          // Erreurs de parsing
          'Unexpected token',
          'SyntaxError',
          'JSON.parse',
          'Unexpected end of JSON input',

          // Erreurs d'opérations abandonnées
          'Operation was aborted',
          'Request aborted',

          // Erreurs de validation Yup
          'ValidationError',
          'yup validation error',

          // Erreurs Framer Motion
          'Animation interrupted',
          'Gesture cancelled',

          // Erreurs React spécifiques
          'ResizeObserver loop limit exceeded',
          'ResizeObserver loop completed with undelivered notifications',
          'Non-Error promise rejection captured',

          // Erreurs CSP
          'Content Security Policy',
          'violated directive',

          // Extensions de navigateur et scripts externes
          'chrome-extension',
          'safari-extension',
          'moz-extension',
          'Script error',
          'Non-Error exception captured',
        ],

        // Ne pas suivre les erreurs pour certaines URL
        denyUrls: [
          // Ressources externes
          /^chrome:\/\//i,
          /^chrome-extension:\/\//i,
          /^moz-extension:\/\//i,
          /^safari-extension:\/\//i,

          // Ressources tierces
          /googletagmanager\.com/i,
          /analytics\.google\.com/i,
          /facebook\.net/i,
          /connect\.facebook\.net/i,
          /graph\.facebook\.com/i,
          /emailjs\.com/i,
        ],

        beforeBreadcrumb(breadcrumb, hint) {
          // Éviter d'enregistrer des informations sensibles dans les breadcrumbs
          if (
            ['xhr', 'fetch'].includes(breadcrumb.category) &&
            breadcrumb.data
          ) {
            // Filtrer les URLs sensibles
            if (breadcrumb.data.url) {
              // Masquer les URLs sensibles du site
              if (
                breadcrumb.data.url.includes('/contact') ||
                breadcrumb.data.url.includes('/order') ||
                breadcrumb.data.url.includes('/templates') ||
                breadcrumb.data.url.includes('cloudinary') ||
                breadcrumb.data.url.includes('emailjs') ||
                breadcrumb.data.url.includes('password') ||
                breadcrumb.data.url.includes('token')
              ) {
                breadcrumb.data.url = '[Filtered URL - Benew Site]';
              } else {
                breadcrumb.data.url = anonymizeUrl(breadcrumb.data.url);
              }
            }

            // Filtrer les corps de requête
            if (breadcrumb.data.body) {
              const filteredResult = filterRequestBody(breadcrumb.data.body);
              if (
                typeof filteredResult === 'object' &&
                filteredResult.filtered
              ) {
                breadcrumb.data.body = filteredResult.filtered;
                breadcrumb.data.bodySize = filteredResult.bodySize;
              } else if (filteredResult !== breadcrumb.data.body) {
                breadcrumb.data.body = filteredResult;
              }
            }

            // Filtrer les headers de response
            if (breadcrumb.data.response_headers) {
              breadcrumb.data.response_headers = anonymizeHeaders(
                breadcrumb.data.response_headers,
              );
            }
          }

          // Filtrer les breadcrumbs de console pour éviter les logs sensibles
          if (breadcrumb.category === 'console' && breadcrumb.message) {
            if (containsSensitiveData(breadcrumb.message)) {
              breadcrumb.message =
                '[Log filtré contenant des données sensibles]';
            }
          }

          return breadcrumb;
        },

        beforeSend(event, hint) {
          const error = hint && hint.originalException;

          // Ne pas envoyer d'événements pour les pages sensibles
          if (
            event.request?.url?.includes('/contact') ||
            event.request?.url?.includes('/order') ||
            event.request?.url?.includes('/templates') ||
            event.request?.url?.includes('cloudinary') ||
            event.request?.url?.includes('emailjs')
          ) {
            return null;
          }

          // Ajouter la catégorie d'erreur spécifique à votre application
          if (error) {
            event.tags = event.tags || {};
            event.tags.error_category = categorizeError(error);

            // Ajouter des tags spécifiques au contexte de votre site
            if (event.request && event.request.url) {
              const url = event.request.url;
              if (url.includes('/blog/')) {
                event.tags.page_type = 'blog';
              } else if (url.includes('/templates/')) {
                event.tags.page_type = 'templates';
              } else if (url.includes('/contact')) {
                event.tags.page_type = 'contact';
              } else if (url.includes('/presentation')) {
                event.tags.page_type = 'presentation';
              } else if (url === '/') {
                event.tags.page_type = 'homepage';
              }
            }
          }

          // Anonymiser les headers
          if (event.request && event.request.headers) {
            event.request.headers = anonymizeHeaders(event.request.headers);
          }

          // Anonymiser les cookies
          if (event.request && event.request.cookies) {
            event.request.cookies = '[FILTERED]';
          }

          // Anonymiser les données utilisateurs
          if (event.user) {
            event.user = anonymizeUserData(event.user);
          }

          // Anonymiser les URL
          if (event.request && event.request.url) {
            event.request.url = anonymizeUrl(event.request.url);
          }

          // Filtrer les messages d'erreur sensibles
          if (event.message && containsSensitiveData(event.message)) {
            event.message = `[Message filtré] ${event.message.substring(0, 50)}...`;
          }

          // Filtrer les données sensibles dans les frames de stack
          if (event.exception && event.exception.values) {
            event.exception.values.forEach((exceptionValue) => {
              if (
                exceptionValue.stacktrace &&
                exceptionValue.stacktrace.frames
              ) {
                exceptionValue.stacktrace.frames.forEach((frame) => {
                  if (frame.vars) {
                    Object.keys(frame.vars).forEach((key) => {
                      const value = String(frame.vars[key] || '');
                      if (
                        containsSensitiveData(key) ||
                        containsSensitiveData(value)
                      ) {
                        frame.vars[key] = '[FILTERED]';
                      }
                    });
                  }

                  // Filtrer les chemins de fichiers potentiellement sensibles
                  if (
                    frame.filename &&
                    frame.filename.includes('node_modules')
                  ) {
                    frame.filename = frame.filename.replace(
                      /.*node_modules/,
                      '[...]/node_modules',
                    );
                  }
                });
              }
            });
          }

          // Filtrer les données dans les contextes
          if (event.contexts) {
            Object.keys(event.contexts).forEach((contextKey) => {
              const context = event.contexts[contextKey];
              if (typeof context === 'object' && context !== null) {
                Object.keys(context).forEach((key) => {
                  const value = String(context[key] || '');
                  if (
                    containsSensitiveData(key) ||
                    containsSensitiveData(value)
                  ) {
                    context[key] = '[FILTERED]';
                  }
                });
              }
            });
          }

          // Ajouter des tags spécifiques au contexte du site Benew
          event.tags = {
            ...event.tags,
            project: 'benew-client',
            stack: 'nextjs15-postgres-cloudinary-emailjs',
          };

          return event;
        },
      });

      console.log('✅ Sentry initialized successfully for Benew Client');
    } catch (error) {
      console.error('❌ Failed to initialize Sentry:', error);
    }
  } else {
    console.warn(
      '⚠️ Invalid or missing Sentry DSN. Sentry will not be initialized.',
    );
  }
}

// Instrumentation pour les erreurs de requête spécifiques au site
export async function onRequestError({ error, request }) {
  try {
    // Contexte enrichi spécifique à votre site
    const context = {
      route: request.url,
      method: request.method,
      headers: {},
      errorCategory: categorizeError(error),
      timestamp: new Date().toISOString(),
    };

    // Identifier le type de page pour un meilleur debugging
    if (request.url) {
      if (request.url.includes('/blog/')) {
        context.pageType = 'blog';
      } else if (request.url.includes('/templates/')) {
        context.pageType = 'templates';
      } else if (request.url.includes('/contact')) {
        context.pageType = 'contact';
      } else if (request.url.includes('/presentation')) {
        context.pageType = 'presentation';
      } else if (request.url === '/') {
        context.pageType = 'homepage';
      }
    }

    // Headers sécurisés pour le debugging
    const safeHeaders = [
      'user-agent',
      'referer',
      'accept-language',
      'content-type',
      'accept',
      'content-length',
    ];

    safeHeaders.forEach((header) => {
      const value =
        request.headers && request.headers.get && request.headers.get(header);
      if (value) {
        context.headers[header] = value;
      }
    });

    // Ajouter le contexte à Sentry
    Sentry.setContext('request', context);

    // Tags spécifiques pour le filtrage dans Sentry
    const tags = {
      component: 'server',
      error_category: categorizeError(error),
      page_type: context.pageType || 'unknown',
    };

    // Capturer l'erreur avec contexte enrichi
    Sentry.captureException(error, {
      tags,
      level: error.name === 'ValidationError' ? 'warning' : 'error',
    });
  } catch (sentryError) {
    console.error('❌ Error in onRequestError instrumentation:', sentryError);
  }
}

// =============================================
// API DÉVELOPPEUR
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
 */
export const initSentry = () => {
  // Cette fonction utilise maintenant le register() automatique de Next.js
  console.log(
    '✅ Sentry init called - using automatic Next.js instrumentation',
  );
};
