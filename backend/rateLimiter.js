/**
 * Système de rate limiting avancé pour BENEW - Next.js 15
 * Adapté aux spécificités du projet : Server Actions, blog, templates, commandes
 * Sans dépendances externes - Version avec monitoring Sentry
 */

import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

/**
 * Préréglages spécifiques aux endpoints BENEW
 * @enum {Object}
 */
export const BENEW_RATE_LIMIT_PRESETS = {
  // Pages publiques (blog, templates)
  PUBLIC_PAGES: {
    windowMs: 60 * 1000, // 1 minute
    max: 50, // 50 requêtes par minute
    message: 'Trop de requêtes sur cette page, veuillez réessayer plus tard',
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },

  // Server Actions de commande (createOrder)
  ORDER_ACTIONS: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 3, // 3 commandes par 5 minutes max
    message:
      'Trop de tentatives de commande, veuillez patienter avant de réessayer',
    skipSuccessfulRequests: true, // Ne pas compter les commandes réussies
    skipFailedRequests: false,
  },

  // Formulaire de contact (EmailJS)
  CONTACT_FORM: {
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5, // 5 messages par 10 minutes
    message: 'Trop de messages envoyés, veuillez patienter avant de renvoyer',
    skipSuccessfulRequests: true,
    skipFailedRequests: false,
  },

  // Images Cloudinary (galeries d'applications)
  IMAGE_REQUESTS: {
    windowMs: 2 * 60 * 1000, // 2 minutes
    max: 100, // 100 images par 2 minutes
    message: "Trop de requêtes d'images, veuillez réessayer plus tard",
    skipSuccessfulRequests: false,
    skipFailedRequests: true,
  },

  // API du blog (articles)
  BLOG_API: {
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 articles par minute
    message: 'Trop de requêtes sur le blog, veuillez réessayer plus tard',
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },

  // API des templates et applications
  TEMPLATES_API: {
    windowMs: 60 * 1000, // 1 minute
    max: 40, // 40 requêtes par minute
    message: 'Trop de requêtes sur les templates, veuillez réessayer plus tard',
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },

  // Présentation interactive (slider 3D)
  PRESENTATION_INTERACTIONS: {
    windowMs: 60 * 1000, // 1 minute
    max: 200, // 200 interactions par minute (slider très interactif)
    message: "Trop d'interactions, veuillez ralentir",
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
};

/**
 * Niveaux de violation spécifiques à BENEW
 * @enum {Object}
 */
export const BENEW_VIOLATION_LEVELS = {
  LOW: {
    threshold: 1.3, // Dépassement de 30% (plus tolérant pour UX)
    blockDuration: 0,
    severity: 'low',
    logLevel: 'info',
    sentryLevel: 'info',
  },
  MEDIUM: {
    threshold: 2.5, // 2.5x la limite
    blockDuration: 3 * 60 * 1000, // 3 minutes (plus court pour e-commerce)
    severity: 'medium',
    logLevel: 'warning',
    sentryLevel: 'warning',
  },
  HIGH: {
    threshold: 5, // 5x la limite
    blockDuration: 15 * 60 * 1000, // 15 minutes
    severity: 'high',
    logLevel: 'warning',
    sentryLevel: 'warning',
  },
  SEVERE: {
    threshold: 10, // 10x la limite
    blockDuration: 60 * 60 * 1000, // 1 heure (commerce critique)
    severity: 'severe',
    logLevel: 'error',
    sentryLevel: 'error',
  },
};

// Stockage en mémoire
const requestCache = new Map();
const blockedIPs = new Map();
const suspiciousBehavior = new Map();
const orderAttempts = new Map(); // Spécial pour tracking des commandes

// Liste blanche des IPs (développeurs, admin)
const BENEW_IP_WHITELIST = new Set([
  '127.0.0.1',
  '::1',
  // Ajoutez les IPs de votre équipe BENEW
]);

/**
 * Extraction d'IP adaptée aux déploiements BENEW (Vercel/Cloudflare)
 * @param {Object} req - La requête HTTP
 * @returns {string} L'IP réelle du client
 */
function extractRealIp(req) {
  // Headers spécifiques à Vercel et Cloudflare (utilisés par BENEW)
  const vercelForwardedFor =
    req.headers.get?.('x-vercel-forwarded-for') ||
    req.headers['x-vercel-forwarded-for'];
  const cfConnectingIp =
    req.headers.get?.('cf-connecting-ip') || req.headers['cf-connecting-ip'];
  const forwardedFor =
    req.headers.get?.('x-forwarded-for') || req.headers['x-forwarded-for'];
  const realIp = req.headers.get?.('x-real-ip') || req.headers['x-real-ip'];

  let ip = '0.0.0.0';

  if (cfConnectingIp) {
    ip = cfConnectingIp;
  } else if (vercelForwardedFor) {
    ip = vercelForwardedFor.split(',')[0].trim();
  } else if (forwardedFor) {
    ip = forwardedFor.split(',')[0].trim();
  } else if (realIp) {
    ip = realIp;
  } else if (req.socket?.remoteAddress) {
    ip = req.socket.remoteAddress;
  } else if (req.ip) {
    ip = req.ip;
  }

  // Nettoyer l'IP (enlever les préfixes IPv6)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  return ip;
}

/**
 * Anonymisation d'IP pour les logs BENEW
 * @param {string} ip - L'adresse IP à anonymiser
 * @returns {string} L'IP anonymisée
 */
function anonymizeIp(ip) {
  if (!ip || typeof ip !== 'string') return '0.0.0.0';

  if (ip.includes('.')) {
    // IPv4: Masquer les deux derniers octets pour plus de confidentialité
    const parts = ip.split('.');
    if (parts.length === 4) {
      parts[2] = 'xx';
      parts[3] = 'xx';
      return parts.join('.');
    }
  } else if (ip.includes(':')) {
    // IPv6: Ne garder que le préfixe
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return parts.slice(0, 3).join(':') + '::xxx';
    }
  }

  return ip.substring(0, Math.floor(ip.length / 3)) + 'xxx';
}

/**
 * Génération de clé spécifique aux endpoints BENEW
 * @param {Object} req - Requête Next.js
 * @param {string} prefix - Préfixe pour la clé
 * @param {Object} options - Options supplémentaires
 * @returns {string} Clé unique
 */
function generateBenewKey(req, prefix = 'benew') {
  const ip = extractRealIp(req);
  const path = req.url || req.nextUrl?.pathname || '';

  // Pour les Server Actions de commande, inclure plus de contexte
  if (prefix === 'order' && req.body) {
    try {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (body.email) {
        const emailHash = Buffer.from(body.email)
          .toString('base64')
          .substring(0, 10);
        return `${prefix}:email:${emailHash}:ip:${ip}`;
      }
    } catch (e) {
      // Ignore les erreurs de parsing
    }
  }

  // Pour le formulaire de contact
  if (prefix === 'contact' && req.body) {
    try {
      const body =
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (body.email) {
        const emailHash = Buffer.from(body.email)
          .toString('base64')
          .substring(0, 8);
        return `${prefix}:contact:${emailHash}:ip:${ip}`;
      }
    } catch (e) {
      // Ignore
    }
  }

  // Pour les templates/applications, inclure l'ID
  if (path.includes('/templates/') || path.includes('/applications/')) {
    const pathSegments = path.split('/').filter(Boolean);
    const resourceId = pathSegments[pathSegments.length - 1];
    return `${prefix}:resource:${resourceId}:ip:${ip}`;
  }

  // Clé par défaut avec IP
  return `${prefix}:ip:${ip}:path:${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Analyse comportementale spécifique au e-commerce BENEW
 * @param {string} key - Clé d'identification
 * @param {string} endpoint - Endpoint appelé
 * @returns {Object} Résultat de l'analyse
 */
function analyzeBenewBehavior(key, endpoint = '') {
  const data = suspiciousBehavior.get(key);
  if (!data)
    return { isSuspicious: false, threatLevel: 0, detectionPoints: [] };

  let threatScore = 0;
  const results = { detectionPoints: [] };

  // Violations multiples sur les commandes (très suspect)
  if (data.violations >= 20 && endpoint.includes('order')) {
    threatScore += 6;
    results.detectionPoints.push('multiple_order_violations');
  } else if (data.violations >= 50) {
    threatScore += 4;
    results.detectionPoints.push('high_violation_count');
  }

  // Scan rapide de templates (comportement de bot)
  if (
    data.endpoints.size >= 15 &&
    [...data.endpoints].some((ep) => ep.includes('template'))
  ) {
    threatScore += 5;
    results.detectionPoints.push('template_scanning_behavior');
  }

  // Requêtes rapides sur le slider présentation (automation)
  const presentationEndpoints = [...data.endpoints].filter((ep) =>
    ep.includes('presentation'),
  );
  if (presentationEndpoints.length > 10) {
    threatScore += 3;
    results.detectionPoints.push('presentation_automation_detected');
  }

  // Tentatives de commande multiples échouées
  const orderData = orderAttempts.get(key);
  if (orderData && orderData.failedAttempts >= 3) {
    threatScore += 4;
    results.detectionPoints.push('multiple_failed_orders');
  }

  // Taux d'erreur élevé sur des endpoints critiques
  if (
    data.errorRequests / Math.max(data.totalRequests, 1) > 0.4 &&
    data.totalRequests > 3
  ) {
    threatScore += 3;
    results.detectionPoints.push('high_error_rate_critical_endpoints');
  }

  // Accès aux endpoints sensibles BENEW
  const sensitiveEndpoints = [
    '/contact',
    '/templates',
    '/_next/action',
    '/order',
  ];
  if (sensitiveEndpoints.some((ep) => endpoint.includes(ep))) {
    threatScore += 1;
    results.detectionPoints.push('sensitive_benew_endpoint_access');
  }

  // Détection de pattern de scraping d'images
  const imageRequests = [...data.endpoints].filter(
    (ep) =>
      ep.includes('cloudinary') ||
      ep.includes('image') ||
      ep.includes('_next/image'),
  ).length;
  if (imageRequests > 50) {
    threatScore += 2;
    results.detectionPoints.push('image_scraping_pattern');
  }

  results.isSuspicious = threatScore >= 4; // Seuil plus bas pour e-commerce
  results.threatLevel = threatScore;
  return results;
}

/**
 * Tracking spécialisé pour les tentatives de commande
 * @param {string} key - Clé d'identification
 * @param {boolean} success - Si la commande a réussi
 */
function trackOrderAttempt(key, success = false) {
  const existing = orderAttempts.get(key) || {
    totalAttempts: 0,
    successfulOrders: 0,
    failedAttempts: 0,
    lastAttempt: Date.now(),
    firstAttempt: Date.now(),
  };

  existing.totalAttempts += 1;
  existing.lastAttempt = Date.now();

  if (success) {
    existing.successfulOrders += 1;
  } else {
    existing.failedAttempts += 1;
  }

  orderAttempts.set(key, existing);
}

/**
 * Middleware de rate limiting principal pour BENEW
 * @param {string|Object} presetOrOptions - Préréglage ou options personnalisées
 * @param {Object} additionalOptions - Options supplémentaires
 * @returns {Function} Middleware Next.js
 */
export function applyBenewRateLimit(
  presetOrOptions = 'PUBLIC_PAGES',
  additionalOptions = {},
) {
  // Déterminer la configuration
  let config;
  if (typeof presetOrOptions === 'string') {
    config = {
      ...(BENEW_RATE_LIMIT_PRESETS[presetOrOptions] ||
        BENEW_RATE_LIMIT_PRESETS.PUBLIC_PAGES),
      ...additionalOptions,
    };
  } else {
    config = {
      ...BENEW_RATE_LIMIT_PRESETS.PUBLIC_PAGES,
      ...presetOrOptions,
      ...additionalOptions,
    };
  }

  return async function (req) {
    const path = req.url || req.nextUrl?.pathname || '';
    const ip = extractRealIp(req);

    try {
      // 1. Vérifier si l'IP est en liste blanche BENEW
      if (BENEW_IP_WHITELIST.has(ip)) {
        console.log(
          `[BENEW Rate Limit] Request allowed from whitelisted IP: ${anonymizeIp(ip)}`,
        );
        return null;
      }

      // 2. Vérifier si l'IP est bloquée
      const blockInfo = blockedIPs.get(ip);
      if (blockInfo && blockInfo.until > Date.now()) {
        const eventId = uuidv4();

        console.warn(
          `[BENEW Rate Limit] Blocked IP request rejected: ${anonymizeIp(ip)}`,
        );

        // Log vers Sentry si disponible
        if (typeof window !== 'undefined' && window.Sentry) {
          window.Sentry.captureMessage('BENEW: Request from blocked IP', {
            level: 'warning',
            tags: { component: 'benew-rate-limit' },
            extra: { eventId, ip: anonymizeIp(ip), path },
          });
        }

        return NextResponse.json(
          {
            status: 429,
            error: 'Accès temporairement restreint',
            message: blockInfo.message || config.message,
            retryAfter: Math.ceil((blockInfo.until - Date.now()) / 1000),
            reference: eventId,
          },
          {
            status: 429,
            headers: {
              'Retry-After': Math.ceil(
                (blockInfo.until - Date.now()) / 1000,
              ).toString(),
            },
          },
        );
      }

      // 3. Générer une clé spécifique BENEW
      const key = generateBenewKey(
        req,
        additionalOptions.prefix ||
          (typeof presetOrOptions === 'string'
            ? presetOrOptions.toLowerCase()
            : 'benew'),
        additionalOptions,
      );

      // 4. Gérer le cache des requêtes
      const now = Date.now();
      const windowStart = now - config.windowMs;
      let requestData = requestCache.get(key) || {
        requests: [],
        successCount: 0,
        errorCount: 0,
      };

      // Supprimer les requêtes expirées
      requestData.requests = requestData.requests.filter(
        (timestamp) => timestamp > windowStart,
      );

      // 5. Vérifier la limite
      const currentRequests = requestData.requests.length;

      if (currentRequests >= config.max) {
        // Analyser le comportement spécifique BENEW
        const behavior = analyzeBenewBehavior(key, path);

        // Déterminer le niveau de violation
        let violationLevel = BENEW_VIOLATION_LEVELS.LOW;
        const violationRatio = currentRequests / config.max;

        for (const level of Object.values(BENEW_VIOLATION_LEVELS)) {
          if (violationRatio >= level.threshold) {
            violationLevel = level;
          }
        }

        // Calculer la durée de blocage
        let blockDuration = violationLevel.blockDuration;
        if (behavior.isSuspicious) {
          blockDuration *= 1 + Math.min(behavior.threatLevel, 8) / 4;
        }

        const eventId = uuidv4();

        // Logging spécialisé BENEW
        console[violationLevel.logLevel](
          `[BENEW Rate Limit] Violation detected`,
          {
            eventId,
            ip: anonymizeIp(ip),
            path,
            requests: currentRequests,
            limit: config.max,
            violationLevel: violationLevel.severity,
            suspicious: behavior.isSuspicious,
            detectionPoints: behavior.detectionPoints,
          },
        );

        // Bloquer pour violations sévères
        if (
          violationLevel.severity === 'severe' ||
          (violationLevel.severity === 'high' && behavior.threatLevel >= 6)
        ) {
          blockedIPs.set(ip, {
            until: now + blockDuration,
            reason: 'Severe BENEW rate limit violation',
            message:
              "Votre accès à BENEW est temporairement restreint en raison d'un usage abusif.",
          });
        }

        // Message personnalisé selon le contexte BENEW
        let message = config.message;
        if (path.includes('/order') || path.includes('createOrder')) {
          message =
            'Trop de tentatives de commande. Veuillez patienter avant de réessayer.';
        } else if (path.includes('/contact')) {
          message =
            'Trop de messages envoyés. Veuillez patienter avant de renvoyer un message.';
        } else if (path.includes('/templates')) {
          message =
            'Trop de requêtes sur nos templates. Veuillez ralentir votre navigation.';
        }

        const retryAfter = Math.ceil((now + blockDuration - now) / 1000);

        return NextResponse.json(
          {
            status: 429,
            error: 'Limite de requêtes BENEW dépassée',
            message,
            retryAfter,
            reference: eventId,
          },
          {
            status: 429,
            headers: {
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': config.max.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': Math.ceil(
                (now + config.windowMs) / 1000,
              ).toString(),
            },
          },
        );
      }

      // 6. Enregistrer cette requête
      requestData.requests.push(now);
      requestCache.set(key, requestData);

      // 7. Tracking spécialisé pour commandes
      if (path.includes('order') || path.includes('createOrder')) {
        trackOrderAttempt(key, true); // Assume success à ce stade
      }

      console.log(
        `[BENEW Rate Limit] Request allowed: ${anonymizeIp(ip)} -> ${path}`,
      );
      return null;
    } catch (error) {
      console.error('[BENEW Rate Limit] Error in middleware:', error.message);

      // Log vers Sentry si disponible
      if (typeof window !== 'undefined' && window.Sentry) {
        window.Sentry.captureException(error, {
          tags: { component: 'benew-rate-limit', type: 'middleware-error' },
          extra: { path, ip: anonymizeIp(ip) },
        });
      }

      // Fail open pour l'expérience utilisateur BENEW
      return null;
    }
  };
}

/**
 * Middleware spécialisé pour les Server Actions BENEW
 * @param {string} actionType - Type d'action ('order', 'contact', etc.)
 * @returns {Function} Middleware pour Server Actions
 */
export function applyBenewServerActionLimit(actionType = 'order') {
  const presets = {
    order: 'ORDER_ACTIONS',
    contact: 'CONTACT_FORM',
    general: 'PUBLIC_PAGES',
  };

  return applyBenewRateLimit(presets[actionType] || presets.general, {
    prefix: actionType,
  });
}

/**
 * Fonction utilitaire pour les routes API BENEW
 * @param {string} apiType - Type d'API ('blog', 'templates', etc.)
 * @returns {Function} Fonction de rate limiting
 */
export function limitBenewAPI(apiType = 'blog') {
  const presets = {
    blog: 'BLOG_API',
    templates: 'TEMPLATES_API',
    images: 'IMAGE_REQUESTS',
    presentation: 'PRESENTATION_INTERACTIONS',
  };

  return applyBenewRateLimit(presets[apiType] || presets.blog, {
    prefix: apiType,
  });
}

/**
 * Ajouter une IP à la liste blanche BENEW
 * @param {string} ip - Adresse IP à ajouter
 */
export function addToBenewWhitelist(ip) {
  BENEW_IP_WHITELIST.add(ip);
  console.log(`[BENEW Rate Limit] Added IP to whitelist: ${anonymizeIp(ip)}`);
}

/**
 * Obtenir les statistiques du rate limiting BENEW
 * @returns {Object} Statistiques
 */
export function getBenewRateLimitStats() {
  const stats = {
    activeKeys: requestCache.size,
    suspiciousBehaviors: suspiciousBehavior.size,
    blockedIPs: blockedIPs.size,
    orderAttempts: orderAttempts.size,
    whitelistedIPs: BENEW_IP_WHITELIST.size,
    timestamp: new Date().toISOString(),
  };

  console.log('[BENEW Rate Limit] Current statistics:', stats);
  return stats;
}

/**
 * Réinitialiser toutes les données BENEW
 */
export function resetBenewRateLimitData() {
  const beforeStats = {
    requestCache: requestCache.size,
    blockedIPs: blockedIPs.size,
    suspiciousBehavior: suspiciousBehavior.size,
    orderAttempts: orderAttempts.size,
  };

  requestCache.clear();
  blockedIPs.clear();
  suspiciousBehavior.clear();
  orderAttempts.clear();

  console.log('[BENEW Rate Limit] All data reset', { beforeStats });
}

// Nettoyage périodique adapté à BENEW
if (
  typeof setInterval !== 'undefined' &&
  process.env.NODE_ENV !== 'production'
) {
  const cleanupInterval = setInterval(
    () => {
      try {
        const now = Date.now();
        let cleaned = 0;

        // Nettoyer les IPs bloquées expirées
        for (const [ip, blockInfo] of blockedIPs.entries()) {
          if (blockInfo.until <= now) {
            blockedIPs.delete(ip);
            cleaned++;
          }
        }

        // Nettoyer les tentatives de commande anciennes (1 heure)
        for (const [key, data] of orderAttempts.entries()) {
          if (now - data.lastAttempt > 60 * 60 * 1000) {
            orderAttempts.delete(key);
            cleaned++;
          }
        }

        // Nettoyer les comportements suspects anciens (2 heures)
        for (const [key, data] of suspiciousBehavior.entries()) {
          if (now - data.lastSeen > 2 * 60 * 60 * 1000) {
            suspiciousBehavior.delete(key);
            cleaned++;
          }
        }

        if (cleaned > 0) {
          console.log(
            `[BENEW Rate Limit] Cleanup completed: ${cleaned} items removed`,
          );
        }
      } catch (error) {
        console.error('[BENEW Rate Limit] Cleanup error:', error.message);
      }
    },
    10 * 60 * 1000,
  ); // Toutes les 10 minutes

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

// Export par défaut pour compatibilité
export default {
  applyBenewRateLimit,
  applyBenewServerActionLimit,
  limitBenewAPI,
  addToBenewWhitelist,
  getBenewRateLimitStats,
  resetBenewRateLimitData,
  BENEW_RATE_LIMIT_PRESETS,
  BENEW_VIOLATION_LEVELS,
};
