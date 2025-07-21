// utils/doppler.js
// Utilitaire Doppler pour récupérer les secrets de manière sécurisée
// Compatible avec Next.js 15 + Sentry + PostgreSQL + Cloudinary

import { captureException, captureMessage } from '@/instrumentation';

// =============================
// CONFIGURATION
// =============================

const DOPPLER_CONFIG = {
  // URL de base de l'API Doppler
  baseUrl: 'https://api.doppler.com/v3',

  // Timeout pour les requêtes (5 secondes)
  timeout: 5000,

  // Cache des secrets en mémoire (pour éviter trop d'appels API)
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000, // 5 minutes
  },

  // Retry configuration
  retry: {
    attempts: 3,
    delay: 1000, // 1 seconde
  },
};

// Cache en mémoire pour les secrets
const secretsCache = new Map();

// =============================
// FONCTIONS UTILITAIRES
// =============================

/**
 * Valide le token Doppler
 * @param {string} token - Token Doppler
 * @returns {boolean}
 */
function isValidDopplerToken(token) {
  if (!token || typeof token !== 'string') return false;

  // Format officiel Doppler 2025 pour Service Token
  const tokenPattern = /^dp\.st\.(?:[a-z0-9\-_]{2,35}\.)?[a-zA-Z0-9]{40,44}$/;
  return tokenPattern.test(token);
}

/**
 * Obtient le token Doppler selon l'environnement
 * @returns {string|null}
 */
function getDopplerToken() {
  const token = process.env.DOPPLER_TOKEN;

  if (!token) {
    console.warn('⚠️ DOPPLER_TOKEN not found in environment variables');
    return null;
  }

  if (!isValidDopplerToken(token)) {
    console.error('❌ Invalid DOPPLER_TOKEN format');
    return null;
  }

  return token;
}

/**
 * Génère une clé de cache unique
 * @param {string} token - Token Doppler
 * @returns {string}
 */
function getCacheKey(token) {
  // Utilise les 12 derniers caractères du token pour la clé de cache
  return `doppler_secrets_${token.slice(-12)}`;
}

/**
 * Vérifie si les secrets en cache sont encore valides
 * @param {string} cacheKey - Clé de cache
 * @returns {boolean}
 */
function isCacheValid(cacheKey) {
  if (!DOPPLER_CONFIG.cache.enabled) return false;

  const cached = secretsCache.get(cacheKey);
  if (!cached) return false;

  const now = Date.now();
  return now - cached.timestamp < DOPPLER_CONFIG.cache.ttl;
}

/**
 * Effectue un appel à l'API Doppler avec retry
 * @param {string} token - Token Doppler
 * @returns {Promise<Object>}
 */
async function fetchSecretsFromDoppler(token) {
  const url = `${DOPPLER_CONFIG.baseUrl}/configs/config/secrets`;

  for (let attempt = 1; attempt <= DOPPLER_CONFIG.retry.attempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        DOPPLER_CONFIG.timeout,
      );

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'User-Agent': 'benew-client/1.0.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Doppler API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      if (!data.secrets) {
        throw new Error('Invalid response format from Doppler API');
      }

      captureMessage('Doppler secrets fetched successfully', {
        level: 'debug',
        tags: {
          component: 'doppler_utility',
          operation: 'fetch_secrets',
        },
        extra: {
          attempt,
          secretsCount: Object.keys(data.secrets).length,
        },
      });

      return data.secrets;
    } catch (error) {
      const isLastAttempt = attempt === DOPPLER_CONFIG.retry.attempts;

      if (error.name === 'AbortError') {
        const message = `Doppler API timeout (attempt ${attempt}/${DOPPLER_CONFIG.retry.attempts})`;

        if (isLastAttempt) {
          captureException(new Error(message), {
            tags: {
              component: 'doppler_utility',
              error_type: 'timeout',
            },
            extra: { attempt, timeout: DOPPLER_CONFIG.timeout },
          });
          throw new Error('Doppler API timeout after multiple attempts');
        } else {
          console.warn(`⚠️ ${message}, retrying...`);
        }
      } else {
        const message = `Doppler API error (attempt ${attempt}/${DOPPLER_CONFIG.retry.attempts}): ${error.message}`;

        if (isLastAttempt) {
          captureException(error, {
            tags: {
              component: 'doppler_utility',
              error_type: 'api_error',
            },
            extra: { attempt, url },
          });
          throw error;
        } else {
          console.warn(`⚠️ ${message}, retrying...`);
        }
      }

      // Attendre avant le prochain essai (sauf pour le dernier)
      if (!isLastAttempt) {
        await new Promise((resolve) =>
          setTimeout(resolve, DOPPLER_CONFIG.retry.delay * attempt),
        );
      }
    }
  }
}

// =============================
// FONCTIONS PRINCIPALES
// =============================

/**
 * Récupère tous les secrets depuis Doppler
 * @returns {Promise<Object>} Objet contenant tous les secrets
 */
export async function getDopplerSecrets() {
  const startTime = performance.now();

  try {
    const token = getDopplerToken();
    if (!token) {
      throw new Error('Doppler token not available');
    }

    const cacheKey = getCacheKey(token);

    // Vérifier le cache d'abord
    if (isCacheValid(cacheKey)) {
      const cached = secretsCache.get(cacheKey);

      captureMessage('Doppler secrets served from cache', {
        level: 'debug',
        tags: {
          component: 'doppler_utility',
          cache_hit: true,
        },
        extra: {
          duration: performance.now() - startTime,
          secretsCount: Object.keys(cached.secrets).length,
        },
      });

      return cached.secrets;
    }

    // Récupérer depuis l'API Doppler
    const secrets = await fetchSecretsFromDoppler(token);

    // Mettre en cache
    if (DOPPLER_CONFIG.cache.enabled) {
      secretsCache.set(cacheKey, {
        secrets,
        timestamp: Date.now(),
      });
    }

    const duration = performance.now() - startTime;

    captureMessage('Doppler secrets fetched and cached', {
      level: 'info',
      tags: {
        component: 'doppler_utility',
        cache_miss: true,
      },
      extra: {
        duration,
        secretsCount: Object.keys(secrets).length,
      },
    });

    return secrets;
  } catch (error) {
    const duration = performance.now() - startTime;

    captureException(error, {
      tags: {
        component: 'doppler_utility',
        error_type: 'get_secrets_error',
      },
      extra: {
        duration,
        environment: process.env.NODE_ENV,
      },
    });

    // En cas d'erreur, retourner un objet vide pour éviter de casser l'app
    console.error('❌ Failed to fetch Doppler secrets:', error.message);
    return {};
  }
}

/**
 * Récupère un secret spécifique depuis Doppler
 * @param {string} secretName - Nom du secret à récupérer
 * @param {string} defaultValue - Valeur par défaut si le secret n'existe pas
 * @returns {Promise<string>}
 */
export async function getDopplerSecret(secretName, defaultValue = null) {
  try {
    const secrets = await getDopplerSecrets();

    const secret = secrets[secretName];
    if (!secret) {
      console.warn(`⚠️ Doppler secret '${secretName}' not found`);
      return defaultValue;
    }

    // Les secrets Doppler ont une structure avec 'raw' et 'computed'
    return secret.computed || secret.raw || defaultValue;
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'doppler_utility',
        error_type: 'get_secret_error',
      },
      extra: { secretName },
    });

    console.error(
      `❌ Failed to fetch Doppler secret '${secretName}':`,
      error.message,
    );
    return defaultValue;
  }
}

/**
 * Récupère plusieurs secrets spécifiques depuis Doppler
 * @param {string[]} secretNames - Noms des secrets à récupérer
 * @returns {Promise<Object>} Objet avec les secrets demandés
 */
export async function getDopplerSecretsBatch(secretNames) {
  try {
    const allSecrets = await getDopplerSecrets();
    const result = {};

    secretNames.forEach((name) => {
      const secret = allSecrets[name];
      if (secret) {
        result[name] = secret.computed || secret.raw;
      } else {
        console.warn(`⚠️ Doppler secret '${name}' not found`);
        result[name] = null;
      }
    });

    return result;
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'doppler_utility',
        error_type: 'get_secrets_batch_error',
      },
      extra: { secretNames },
    });

    console.error('❌ Failed to fetch Doppler secrets batch:', error.message);
    return {};
  }
}

/**
 * Initialise la configuration de base avec les secrets Doppler
 * Fonction spécialement adaptée à votre projet Benew
 * @returns {Promise<Object>} Configuration de base avec tous les secrets
 */
export async function initializeBenewConfig() {
  try {
    const secrets = await getDopplerSecrets();

    // Configuration spécifique à votre projet Benew
    const config = {
      // Base de données PostgreSQL
      database: {
        host: secrets.HOST_NAME?.computed || process.env.HOST_NAME,
        port: secrets.PORT_NUMBER?.computed || process.env.PORT_NUMBER,
        database: secrets.DB_NAME?.computed || process.env.DB_NAME,
        username: secrets.USER_NAME?.computed || process.env.USER_NAME,
        password: secrets.DB_PASSWORD?.computed || process.env.DB_PASSWORD,
        ssl: {
          ca: secrets.DB_CA?.computed || process.env.DB_CA,
        },
        connectionTimeout:
          secrets.CONNECTION_TIMEOUT?.computed ||
          process.env.CONNECTION_TIMEOUT,
        maxClients:
          secrets.MAXIMUM_CLIENTS?.computed || process.env.MAXIMUM_CLIENTS,
      },

      // Cloudinary
      cloudinary: {
        cloudName:
          secrets.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.computed ||
          process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        apiKey:
          secrets.NEXT_PUBLIC_CLOUDINARY_API_KEY?.computed ||
          process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
        apiSecret:
          secrets.CLOUDINARY_API_SECRET?.computed ||
          process.env.CLOUDINARY_API_SECRET,
      },

      // Sentry
      sentry: {
        dsn:
          secrets.NEXT_PUBLIC_SENTRY_DSN?.computed ||
          process.env.NEXT_PUBLIC_SENTRY_DSN,
        authToken:
          secrets.SENTRY_AUTH_TOKEN?.computed || process.env.SENTRY_AUTH_TOKEN,
        org: secrets.SENTRY_ORG?.computed || process.env.SENTRY_ORG,
        project: secrets.SENTRY_PROJECT?.computed || process.env.SENTRY_PROJECT,
        release: secrets.SENTRY_RELEASE?.computed || process.env.SENTRY_RELEASE,
      },

      // Site
      site: {
        url:
          secrets.NEXT_PUBLIC_SITE_URL?.computed ||
          process.env.NEXT_PUBLIC_SITE_URL,
        environment: process.env.NODE_ENV,
      },

      // Pour le contact :
      email: {
        resendApiKey:
          secrets.RESEND_API_KEY?.computed || process.env.RESEND_API_KEY,
        fromAddress:
          secrets.RESEND_FROM_EMAIL?.computed || process.env.RESEND_FROM_EMAIL,
        toAddress:
          secrets.RESEND_TO_EMAIL?.computed || process.env.RESEND_TO_EMAIL,
      },
    };

    // Valider que les secrets critiques sont présents
    const criticalSecrets = [
      'HOST_NAME',
      'DB_NAME',
      'USER_NAME',
      'DB_PASSWORD',
      'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_SECRET',
      'NEXT_PUBLIC_SENTRY_DSN',
    ];

    const missingSecrets = criticalSecrets.filter((key) => {
      const secret = secrets[key];
      return !secret || (!secret.computed && !secret.raw);
    });

    if (missingSecrets.length > 0) {
      console.warn(
        `⚠️ Missing critical Doppler secrets: ${missingSecrets.join(', ')}`,
      );
    }

    captureMessage('Benew configuration initialized from Doppler', {
      level: 'info',
      tags: {
        component: 'doppler_utility',
        operation: 'initialize_config',
      },
      extra: {
        secretsCount: Object.keys(secrets).length,
        missingSecrets: missingSecrets.length,
        environment: process.env.NODE_ENV,
      },
    });

    return config;
  } catch (error) {
    captureException(error, {
      tags: {
        component: 'doppler_utility',
        error_type: 'initialize_config_error',
      },
    });

    console.error(
      '❌ Failed to initialize Benew config from Doppler:',
      error.message,
    );

    // Fallback vers les variables d'environnement existantes
    return {
      database: {
        host: process.env.HOST_NAME,
        port: process.env.PORT_NUMBER,
        database: process.env.DB_NAME,
        username: process.env.USER_NAME,
        password: process.env.DB_PASSWORD,
        ssl: { ca: process.env.DB_CA },
        connectionTimeout: process.env.CONNECTION_TIMEOUT,
        maxClients: process.env.MAXIMUM_CLIENTS,
      },
      cloudinary: {
        cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET,
      },
      sentry: {
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        release: process.env.SENTRY_RELEASE,
      },
      site: {
        url: process.env.NEXT_PUBLIC_SITE_URL,
        environment: process.env.NODE_ENV,
      },
    };
  }
}

/**
 * Vide le cache des secrets (utile pour les tests ou le redémarrage)
 */
export function clearDopplerCache() {
  secretsCache.clear();
  console.log('✅ Doppler cache cleared');
}

/**
 * Obtient des statistiques du cache Doppler (pour le monitoring)
 * @returns {Object}
 */
export function getDopplerCacheStats() {
  return {
    size: secretsCache.size,
    enabled: DOPPLER_CONFIG.cache.enabled,
    ttl: DOPPLER_CONFIG.cache.ttl,
    keys: Array.from(secretsCache.keys()),
  };
}

// =============================
// EXPORTS
// =============================

export default {
  getDopplerSecrets,
  getDopplerSecret,
  getDopplerSecretsBatch,
  initializeBenewConfig,
  clearDopplerCache,
  getDopplerCacheStats,
};
