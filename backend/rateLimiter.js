/**
 * Système de rate limiting avancé pour BENEW - Next.js 15 - OPTIMISÉ
 * Adapté aux spécificités du projet : Server Actions, blog, templates, commandes
 * Sans dépendances externes - Version optimisée avec gestion mémoire et logging conditionnel
 */

import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// Configuration adaptative selon l'environnement
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Configuration de logging et mémoire
const CONFIG = {
  logging: {
    enabled: isDevelopment || process.env.BENEW_RATE_LIMIT_LOGS === 'true',
    verboseAllowed: isDevelopment,
    onlyErrors: isProduction,
  },
  memory: {
    maxCacheSize: parseInt(process.env.BENEW_RATE_LIMIT_MAX_CACHE) || 10000,
    maxBlockedIps: parseInt(process.env.BENEW_RATE_LIMIT_MAX_BLOCKED) || 1000,
    maxSuspiciousBehavior:
      parseInt(process.env.BENEW_RATE_LIMIT_MAX_SUSPICIOUS) || 5000,
    maxOrderAttempts: parseInt(process.env.BENEW_RATE_LIMIT_MAX_ORDERS) || 2000,
    cleanupInterval: isProduction ? 15 * 60 * 1000 : 10 * 60 * 1000, // 15min prod, 10min dev
  },
  sentry: {
    enabled: typeof window !== 'undefined' && window.Sentry,
    onlyWarningsAndErrors: isProduction,
  },
};

/**
 * Fonction de logging conditionnelle optimisée
 */
function logConditional(level, message, data = {}) {
  if (!CONFIG.logging.enabled) return;

  // En production, seulement warn et error
  if (CONFIG.logging.onlyErrors && !['warn', 'error'].includes(level)) return;

  // Logging sélectif
  if (level === 'info' && CONFIG.logging.verboseAllowed) {
    console.log(`[BENEW Rate Limit] ${message}`, data);
  } else if (level === 'warn') {
    console.warn(`[BENEW Rate Limit] ${message}`, data);
  } else if (level === 'error') {
    console.error(`[BENEW Rate Limit] ${message}`, data);
  }
}

/**
 * Fonction Sentry conditionnelle optimisée
 */
function reportToSentry(message, level = 'info', extra = {}) {
  if (!CONFIG.sentry.enabled) return;

  // En production, seulement les avertissements et erreurs
  if (CONFIG.sentry.onlyWarningsAndErrors && level === 'info') return;

  window.Sentry.captureMessage(message, {
    level,
    tags: { component: 'benew-rate-limit' },
    extra,
  });
}

/**
 * Préréglages spécifiques aux endpoints BENEW
 */
export const BENEW_RATE_LIMIT_PRESETS = {
  PUBLIC_PAGES: {
    windowMs: 60 * 1000,
    max: 50,
    message: 'Trop de requêtes sur cette page, veuillez réessayer plus tard',
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
  ORDER_ACTIONS: {
    windowMs: 5 * 60 * 1000,
    max: 3,
    message:
      'Trop de tentatives de commande, veuillez patienter avant de réessayer',
    skipSuccessfulRequests: true,
    skipFailedRequests: false,
  },
  CONTACT_FORM: {
    windowMs: 10 * 60 * 1000,
    max: 5,
    message: 'Trop de messages envoyés, veuillez patienter avant de renvoyer',
    skipSuccessfulRequests: true,
    skipFailedRequests: false,
  },
  IMAGE_REQUESTS: {
    windowMs: 2 * 60 * 1000,
    max: 100,
    message: "Trop de requêtes d'images, veuillez réessayer plus tard",
    skipSuccessfulRequests: false,
    skipFailedRequests: true,
  },
  BLOG_API: {
    windowMs: 60 * 1000,
    max: 30,
    message: 'Trop de requêtes sur le blog, veuillez réessayer plus tard',
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
  TEMPLATES_API: {
    windowMs: 60 * 1000,
    max: 40,
    message: 'Trop de requêtes sur les templates, veuillez réessayer plus tard',
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
  PRESENTATION_INTERACTIONS: {
    windowMs: 60 * 1000,
    max: 200,
    message: "Trop d'interactions, veuillez ralentir",
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
};

/**
 * Niveaux de violation optimisés pour BENEW
 */
export const BENEW_VIOLATION_LEVELS = {
  LOW: {
    threshold: 1.3,
    blockDuration: 0,
    severity: 'low',
    logLevel: 'info',
    sentryLevel: 'info',
  },
  MEDIUM: {
    threshold: 2.5,
    blockDuration: 3 * 60 * 1000,
    severity: 'medium',
    logLevel: 'warning',
    sentryLevel: 'warning',
  },
  HIGH: {
    threshold: 5,
    blockDuration: 15 * 60 * 1000,
    severity: 'high',
    logLevel: 'warning',
    sentryLevel: 'warning',
  },
  SEVERE: {
    threshold: 10,
    blockDuration: 60 * 60 * 1000,
    severity: 'severe',
    logLevel: 'error',
    sentryLevel: 'error',
  },
};

// =============================================
// STOCKAGE EN MÉMOIRE AVEC GESTION DE TAILLE
// =============================================

/**
 * Map avec limitation de taille et éviction LRU
 */
class LimitedMap extends Map {
  constructor(maxSize) {
    super();
    this.maxSize = maxSize;
  }

  set(key, value) {
    // Si la clé existe déjà, la supprimer pour la remettre à la fin
    if (this.has(key)) {
      this.delete(key);
    }
    // Si on dépasse la taille maximale, supprimer le plus ancien
    else if (this.size >= this.maxSize) {
      const firstKey = this.keys().next().value;
      this.delete(firstKey);
    }

    return super.set(key, value);
  }
}

// Stockage optimisé avec limitations
const requestCache = new LimitedMap(CONFIG.memory.maxCacheSize);
const blockedIPs = new LimitedMap(CONFIG.memory.maxBlockedIps);
const suspiciousBehavior = new LimitedMap(CONFIG.memory.maxSuspiciousBehavior);
const orderAttempts = new LimitedMap(CONFIG.memory.maxOrderAttempts);

// Liste blanche externalisée
const BENEW_IP_WHITELIST = new Set(
  (process.env.BENEW_WHITELIST_IPS || '127.0.0.1,::1')
    .split(',')
    .map((ip) => ip.trim()),
);

/**
 * Extraction d'IP optimisée pour déploiements BENEW
 */
function extractRealIp(req) {
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

  // Nettoyer l'IP
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  return ip;
}

/**
 * Anonymisation d'IP optimisée
 */
function anonymizeIp(ip) {
  if (!ip || typeof ip !== 'string') return '0.0.0.0';

  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      parts[2] = 'xx';
      parts[3] = 'xx';
      return parts.join('.');
    }
  } else if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 4) {
      return parts.slice(0, 3).join(':') + '::xxx';
    }
  }

  return ip.substring(0, Math.floor(ip.length / 3)) + 'xxx';
}

/**
 * Génération de clé optimisée
 */
function generateBenewKey(req, prefix = 'benew') {
  const ip = extractRealIp(req);
  const path = req.url || req.nextUrl?.pathname || '';

  // Pour les Server Actions de commande
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
      // Ignore silencieusement
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
      // Ignore silencieusement
    }
  }

  // Pour les templates/applications
  if (path.includes('/templates/') || path.includes('/applications/')) {
    const pathSegments = path.split('/').filter(Boolean);
    const resourceId = pathSegments[pathSegments.length - 1];
    return `${prefix}:resource:${resourceId}:ip:${ip}`;
  }

  return `${prefix}:ip:${ip}:path:${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Analyse comportementale optimisée
 */
function analyzeBenewBehavior(key, endpoint = '') {
  const data = suspiciousBehavior.get(key);
  if (!data)
    return { isSuspicious: false, threatLevel: 0, detectionPoints: [] };

  let threatScore = 0;
  const results = { detectionPoints: [] };

  // Violations multiples sur les commandes
  if (data.violations >= 20 && endpoint.includes('order')) {
    threatScore += 6;
    results.detectionPoints.push('multiple_order_violations');
  } else if (data.violations >= 50) {
    threatScore += 4;
    results.detectionPoints.push('high_violation_count');
  }

  // Scan rapide de templates
  if (
    data.endpoints.size >= 15 &&
    [...data.endpoints].some((ep) => ep.includes('template'))
  ) {
    threatScore += 5;
    results.detectionPoints.push('template_scanning_behavior');
  }

  // Requêtes rapides sur le slider présentation
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

  // Taux d'erreur élevé
  if (
    data.errorRequests / Math.max(data.totalRequests, 1) > 0.4 &&
    data.totalRequests > 3
  ) {
    threatScore += 3;
    results.detectionPoints.push('high_error_rate_critical_endpoints');
  }

  // Accès aux endpoints sensibles
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

  results.isSuspicious = threatScore >= 4;
  results.threatLevel = threatScore;
  return results;
}

/**
 * Tracking optimisé pour les commandes
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
 * Middleware principal optimisé
 */
export function applyBenewRateLimit(
  presetOrOptions = 'PUBLIC_PAGES',
  additionalOptions = {},
) {
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
      // Vérifier liste blanche
      if (BENEW_IP_WHITELIST.has(ip)) {
        logConditional(
          'info',
          `Request allowed from whitelisted IP: ${anonymizeIp(ip)}`,
        );
        return null;
      }

      // Vérifier IP bloquée
      const blockInfo = blockedIPs.get(ip);
      if (blockInfo && blockInfo.until > Date.now()) {
        const eventId = uuidv4();

        logConditional(
          'warn',
          `Blocked IP request rejected: ${anonymizeIp(ip)}`,
        );

        reportToSentry('BENEW: Request from blocked IP', 'warning', {
          eventId,
          ip: anonymizeIp(ip),
          path,
        });

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

      // Générer clé
      const key = generateBenewKey(
        req,
        additionalOptions.prefix ||
          (typeof presetOrOptions === 'string'
            ? presetOrOptions.toLowerCase()
            : 'benew'),
        additionalOptions,
      );

      // Gérer cache des requêtes
      const now = Date.now();
      const windowStart = now - config.windowMs;
      let requestData = requestCache.get(key) || {
        requests: [],
        successCount: 0,
        errorCount: 0,
      };

      // Supprimer requêtes expirées
      requestData.requests = requestData.requests.filter(
        (timestamp) => timestamp > windowStart,
      );

      // Vérifier limite
      const currentRequests = requestData.requests.length;

      if (currentRequests >= config.max) {
        // Analyser comportement
        const behavior = analyzeBenewBehavior(key, path);

        // Déterminer niveau de violation
        let violationLevel = BENEW_VIOLATION_LEVELS.LOW;
        const violationRatio = currentRequests / config.max;

        for (const level of Object.values(BENEW_VIOLATION_LEVELS)) {
          if (violationRatio >= level.threshold) {
            violationLevel = level;
          }
        }

        // Calculer durée de blocage
        let blockDuration = violationLevel.blockDuration;
        if (behavior.isSuspicious) {
          blockDuration *= 1 + Math.min(behavior.threatLevel, 8) / 4;
        }

        const eventId = uuidv4();

        // Logging optimisé selon severity
        if (
          violationLevel.severity === 'severe' ||
          violationLevel.severity === 'high'
        ) {
          logConditional(violationLevel.logLevel, 'Violation detected', {
            eventId,
            ip: anonymizeIp(ip),
            path,
            requests: currentRequests,
            limit: config.max,
            violationLevel: violationLevel.severity,
            suspicious: behavior.isSuspicious,
            detectionPoints: behavior.detectionPoints,
          });

          reportToSentry(
            'BENEW: Rate limit violation',
            violationLevel.sentryLevel,
            {
              eventId,
              ip: anonymizeIp(ip),
              path,
              violationLevel: violationLevel.severity,
              threatLevel: behavior.threatLevel,
            },
          );
        }

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

        // Message contextualisé
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

      // Enregistrer requête
      requestData.requests.push(now);
      requestCache.set(key, requestData);

      // Tracking spécialisé pour commandes
      if (path.includes('order') || path.includes('createOrder')) {
        trackOrderAttempt(key, true);
      }

      logConditional('info', `Request allowed: ${anonymizeIp(ip)} -> ${path}`);
      return null;
    } catch (error) {
      logConditional('error', 'Error in middleware:', {
        message: error.message,
      });

      reportToSentry('BENEW Rate Limit: Middleware error', 'error', {
        path,
        ip: anonymizeIp(ip),
        error: error.message,
      });

      // Fail open pour UX
      return null;
    }
  };
}

/**
 * Middleware pour Server Actions
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
 * Fonction pour routes API
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
 * Ajouter IP à la liste blanche
 */
export function addToBenewWhitelist(ip) {
  BENEW_IP_WHITELIST.add(ip);
  logConditional('info', `Added IP to whitelist: ${anonymizeIp(ip)}`);
}

/**
 * Statistiques optimisées
 */
export function getBenewRateLimitStats() {
  const stats = {
    memory: {
      activeKeys: requestCache.size,
      maxCacheSize: CONFIG.memory.maxCacheSize,
      memoryUsage: `${((requestCache.size / CONFIG.memory.maxCacheSize) * 100).toFixed(1)}%`,
    },
    security: {
      suspiciousBehaviors: suspiciousBehavior.size,
      blockedIPs: blockedIPs.size,
      whitelistedIPs: BENEW_IP_WHITELIST.size,
    },
    business: {
      orderAttempts: orderAttempts.size,
    },
    config: {
      environment: process.env.NODE_ENV,
      loggingEnabled: CONFIG.logging.enabled,
      sentryEnabled: CONFIG.sentry.enabled,
    },
    timestamp: new Date().toISOString(),
  };

  logConditional('info', 'Current statistics:', stats);
  return stats;
}

/**
 * Réinitialisation optimisée
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

  logConditional('info', 'All data reset', { beforeStats });
}

// =============================================
// NETTOYAGE PÉRIODIQUE OPTIMISÉ
// =============================================

if (typeof setInterval !== 'undefined') {
  const cleanupInterval = setInterval(() => {
    try {
      const now = Date.now();
      let cleaned = 0;

      // Nettoyer IPs bloquées expirées
      for (const [ip, blockInfo] of blockedIPs.entries()) {
        if (blockInfo.until <= now) {
          blockedIPs.delete(ip);
          cleaned++;
        }
      }

      // Nettoyer tentatives de commande anciennes (1 heure)
      for (const [key, data] of orderAttempts.entries()) {
        if (now - data.lastAttempt > 60 * 60 * 1000) {
          orderAttempts.delete(key);
          cleaned++;
        }
      }

      // Nettoyer comportements suspects anciens (2 heures)
      for (const [key, data] of suspiciousBehavior.entries()) {
        if (now - data.lastSeen > 2 * 60 * 60 * 1000) {
          suspiciousBehavior.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0 && CONFIG.logging.enabled) {
        logConditional('info', `Cleanup completed: ${cleaned} items removed`);
      }
    } catch (error) {
      logConditional('error', 'Cleanup error:', { message: error.message });
    }
  }, CONFIG.memory.cleanupInterval);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

// Export par défaut
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
