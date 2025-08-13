// backend/rateLimiter.js
// Rate limiting simple et pragmatique pour petites applications (500 visiteurs/jour)
// Next.js 15 - Version optimisée sans suringénierie

import { NextResponse } from 'next/server';

// Configuration simple adaptée au trafic réel
const CONFIG = {
  // Limites raisonnables pour 500 visiteurs/jour
  limits: {
    public: { requests: 30, window: 60 * 1000 }, // 30 req/minute pour pages publiques
    api: { requests: 20, window: 60 * 1000 }, // 20 req/minute pour API
    contact: { requests: 3, window: 10 * 60 * 1000 }, // 3 req/10min pour contact
    order: { requests: 2, window: 5 * 60 * 1000 }, // 2 req/5min pour commandes
  },

  // Cache simple - pas besoin de milliers d'entrées
  cache: {
    maxSize: 200, // 200 IPs max en cache (largement suffisant)
    cleanupInterval: 10 * 60 * 1000, // Nettoyage toutes les 10 minutes
  },

  // Logging minimal
  logging: process.env.NODE_ENV === 'development',
};

// Cache simple avec Map native
const requestsCache = new Map();
const blockedIPs = new Map();

// Liste blanche basique
const WHITELIST_IPS = new Set(['127.0.0.1', '::1']);

// =============================================
// UTILITAIRES SIMPLIFIÉS
// =============================================

/**
 * Extraction d'IP simplifiée
 */
function getClientIP(request) {
  // Priorité aux headers de proxy les plus courants
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback
  return '127.0.0.1';
}

/**
 * Anonymisation basique pour les logs
 */
function anonymizeIP(ip) {
  if (!ip || ip === '127.0.0.1') return ip;

  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.xxx.xxx`;
  }

  // IPv6 ou autre format
  return ip.substring(0, 8) + 'xxx';
}

/**
 * Log conditionnel simple
 */
function log(message, data = {}) {
  if (CONFIG.logging) {
    console.log(`[Rate Limit] ${message}`, data);
  }
}

// =============================================
// LOGIQUE PRINCIPALE SIMPLIFIÉE
// =============================================

/**
 * Vérification de rate limit simple
 */
function checkRateLimit(ip, limit) {
  const now = Date.now();
  const windowStart = now - limit.window;

  // Récupérer ou créer l'entrée pour cette IP
  let userData = requestsCache.get(ip);
  if (!userData) {
    userData = { requests: [], blocked: false };
    requestsCache.set(ip, userData);
  }

  // Nettoyer les requêtes expirées
  userData.requests = userData.requests.filter(
    (timestamp) => timestamp > windowStart,
  );

  // Vérifier la limite
  if (userData.requests.length >= limit.requests) {
    log(`Rate limit exceeded for IP: ${anonymizeIP(ip)}`, {
      requests: userData.requests.length,
      limit: limit.requests,
      window: limit.window / 1000 + 's',
    });
    return false;
  }

  // Enregistrer cette requête
  userData.requests.push(now);
  return true;
}

/**
 * Vérification des IPs bloquées
 */
function isIPBlocked(ip) {
  const blockInfo = blockedIPs.get(ip);
  if (!blockInfo) return false;

  if (Date.now() > blockInfo.until) {
    // Le blocage a expiré
    blockedIPs.delete(ip);
    return false;
  }

  return true;
}

/**
 * Bloquer une IP temporairement (pour les cas extrêmes)
 */
function blockIP(ip, duration = 15 * 60 * 1000) {
  // 15 minutes par défaut
  blockedIPs.set(ip, {
    until: Date.now() + duration,
    reason: 'Rate limit exceeded multiple times',
  });

  log(`IP blocked temporarily: ${anonymizeIP(ip)}`, {
    duration: duration / 1000 + 's',
  });
}

// =============================================
// MIDDLEWARE PRINCIPAL SIMPLIFIÉ
// =============================================

/**
 * Middleware de rate limiting adapté
 */
export function createRateLimit(limitType = 'public') {
  const limit = CONFIG.limits[limitType] || CONFIG.limits.public;

  return async function rateLimit(request) {
    const ip = getClientIP(request);
    const path = request.nextUrl?.pathname || request.url || '';

    try {
      // Vérifier la whitelist
      if (WHITELIST_IPS.has(ip)) {
        log(`Whitelisted IP allowed: ${anonymizeIP(ip)}`);
        return null; // Requête autorisée
      }

      // Vérifier si l'IP est bloquée
      if (isIPBlocked(ip)) {
        const blockInfo = blockedIPs.get(ip);
        const remainingTime = Math.ceil((blockInfo.until - Date.now()) / 1000);

        log(`Blocked IP rejected: ${anonymizeIP(ip)}`);

        return NextResponse.json(
          {
            error: 'Accès temporairement bloqué',
            message: 'Veuillez réessayer plus tard',
            retryAfter: remainingTime,
          },
          {
            status: 429,
            headers: {
              'Retry-After': remainingTime.toString(),
              'X-RateLimit-Limit': limit.requests.toString(),
              'X-RateLimit-Remaining': '0',
            },
          },
        );
      }

      // Vérifier le rate limit
      if (!checkRateLimit(ip, limit)) {
        const userData = requestsCache.get(ip);

        // Si c'est un récidiviste, le bloquer temporairement
        if (userData && userData.requests.length > limit.requests * 2) {
          blockIP(ip);
          return NextResponse.json(
            {
              error: 'Accès bloqué pour abus',
              message: 'Trop de tentatives. Accès temporairement restreint.',
            },
            { status: 429 },
          );
        }

        // Rate limit standard
        const resetTime = Math.ceil((Date.now() + limit.window) / 1000);

        return NextResponse.json(
          {
            error: 'Trop de requêtes',
            message: getContextualMessage(path),
            retryAfter: Math.ceil(limit.window / 1000),
          },
          {
            status: 429,
            headers: {
              'Retry-After': Math.ceil(limit.window / 1000).toString(),
              'X-RateLimit-Limit': limit.requests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': resetTime.toString(),
            },
          },
        );
      }

      // Requête autorisée
      const userData = requestsCache.get(ip);
      const remaining = Math.max(0, limit.requests - userData.requests.length);

      log(`Request allowed: ${anonymizeIP(ip)} -> ${path}`, {
        remaining,
        limit: limit.requests,
      });

      return null; // Null = continuer la requête
    } catch (error) {
      log('Rate limit error:', { error: error.message, ip: anonymizeIP(ip) });

      // En cas d'erreur, on laisse passer (fail open)
      return null;
    }
  };
}

/**
 * Messages contextualisés selon l'endpoint
 */
function getContextualMessage(path) {
  if (path.includes('/contact')) {
    return 'Trop de messages envoyés. Veuillez patienter avant de renvoyer.';
  }

  if (path.includes('/order') || path.includes('order')) {
    return 'Trop de tentatives de commande. Veuillez patienter.';
  }

  if (path.includes('/blog')) {
    return 'Trop de requêtes sur le blog. Veuillez ralentir.';
  }

  if (path.includes('/templates')) {
    return 'Trop de requêtes sur les templates. Veuillez patienter.';
  }

  return 'Trop de requêtes. Veuillez réessayer plus tard.';
}

// =============================================
// MIDDLEWARES PRÉ-CONFIGURÉS
// =============================================

export const publicRateLimit = createRateLimit('public');
export const apiRateLimit = createRateLimit('api');
export const contactRateLimit = createRateLimit('contact');
export const orderRateLimit = createRateLimit('order');

// =============================================
// UTILITAIRES D'ADMINISTRATION
// =============================================

/**
 * Statistiques simples
 */
export function getStats() {
  return {
    cache: {
      totalIPs: requestsCache.size,
      blockedIPs: blockedIPs.size,
      maxSize: CONFIG.cache.maxSize,
      usage: `${Math.round((requestsCache.size / CONFIG.cache.maxSize) * 100)}%`,
    },
    config: {
      environment: process.env.NODE_ENV,
      logging: CONFIG.logging,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Ajouter une IP à la whitelist
 */
export function addToWhitelist(ip) {
  WHITELIST_IPS.add(ip);
  log(`IP added to whitelist: ${anonymizeIP(ip)}`);
}

/**
 * Supprimer une IP de la whitelist
 */
export function removeFromWhitelist(ip) {
  WHITELIST_IPS.delete(ip);
  log(`IP removed from whitelist: ${anonymizeIP(ip)}`);
}

/**
 * Débloquer une IP manuellement
 */
export function unblockIP(ip) {
  blockedIPs.delete(ip);
  log(`IP manually unblocked: ${anonymizeIP(ip)}`);
}

/**
 * Réinitialiser le cache (pour les tests)
 */
export function resetCache() {
  const before = {
    requests: requestsCache.size,
    blocked: blockedIPs.size,
  };

  requestsCache.clear();
  blockedIPs.clear();

  log('Cache reset completed', before);
}

// =============================================
// NETTOYAGE AUTOMATIQUE SIMPLE
// =============================================

// Nettoyage périodique simple
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;

  // Nettoyer les IPs bloquées expirées
  for (const [ip, blockInfo] of blockedIPs.entries()) {
    if (now > blockInfo.until) {
      blockedIPs.delete(ip);
      cleaned++;
    }
  }

  // Si le cache devient trop gros, nettoyer les anciennes entrées
  if (requestsCache.size > CONFIG.cache.maxSize) {
    const entries = Array.from(requestsCache.entries());
    const toDelete = entries.slice(0, entries.length - CONFIG.cache.maxSize);

    toDelete.forEach(([ip]) => {
      requestsCache.delete(ip);
      cleaned++;
    });
  }

  if (cleaned > 0) {
    log(`Cleanup completed: ${cleaned} entries removed`);
  }
}, CONFIG.cache.cleanupInterval);

// =============================================
// EXPORT PAR DÉFAUT
// =============================================

export default {
  createRateLimit,
  publicRateLimit,
  apiRateLimit,
  contactRateLimit,
  orderRateLimit,
  getStats,
  addToWhitelist,
  removeFromWhitelist,
  unblockIP,
  resetCache,
};
