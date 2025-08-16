// backend/dbConnect.js
// Connection PostgreSQL optimisée pour petites applications (500 visiteurs/jour)
// Next.js 15 + PostgreSQL + Doppler + Sentry - Version pragmatique

import { Pool } from 'pg';
import { captureException, captureMessage } from '../instrumentation.js';
import { initializeBenewConfig } from '@/utils/doppler';

// Configuration simple et adaptée
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

const CONFIG = {
  // Pool adapté pour 500 visiteurs/jour
  pool: {
    max: 20, // Largement suffisant pour le trafic
    min: 10, // Une connexion minimum
    idleTimeoutMillis: 30000, // 30 secondes
    connectionTimeoutMillis: 5000,
  },

  // Monitoring simple
  monitoring: {
    healthCheckInterval: isProduction ? 30 * 60 * 1000 : 5 * 60 * 1000, // 30min prod / 5min dev
    enableMetrics: isDevelopment, // Métriques seulement en dev
  },

  // Retry basique
  retry: {
    maxAttempts: 3,
    delay: 2000,
  },

  // Logging conditionnel
  logging: {
    enabled: isDevelopment || process.env.DB_DETAILED_LOGS === 'true',
    healthChecks: isDevelopment,
  },
};

// Variables globales
let pool;
let dopplerConfig = null;
let isConfigLoaded = false;
let healthCheckInterval;

// 🔥 NOUVELLE VARIABLE : Promise d'initialisation
let initializationPromise = null;

// Utilitaires
const getTimestamp = () => new Date().toISOString();

// =============================================
// CONFIGURATION DOPPLER SIMPLIFIÉE
// =============================================

async function loadDopplerConfig() {
  if (dopplerConfig && isConfigLoaded) return dopplerConfig;

  try {
    const benewConfig = await initializeBenewConfig();
    dopplerConfig = benewConfig.database;
    isConfigLoaded = true;

    if (CONFIG.logging.enabled) {
      console.log(`[${getTimestamp()}] ✅ Configuration Doppler chargée`);
    }
    return dopplerConfig;
  } catch (error) {
    if (CONFIG.logging.enabled) {
      console.warn(
        `[${getTimestamp()}] ⚠️ Fallback vers variables d'environnement:`,
        error.message,
      );
    }

    // Fallback simple vers les variables d'environnement
    dopplerConfig = {
      host: process.env.DB_HOST_NAME || process.env.DB_HOST_NAME,
      port: Number(process.env.DB_PORT) || Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME,
      username: process.env.DB_USER_NAME || process.env.DB_USER_NAME,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_CA ? { ca: process.env.DB_CA } : false,
    };

    isConfigLoaded = true;
    return dopplerConfig;
  }
}

// =============================================
// CRÉATION DU POOL SIMPLIFIÉ
// =============================================

async function createPool() {
  const config = await loadDopplerConfig();

  const poolConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl,

    // Configuration optimisée pour petite application
    max: CONFIG.pool.max,
    min: CONFIG.pool.min,
    idleTimeoutMillis: CONFIG.pool.idleTimeoutMillis,
    connectionTimeoutMillis: CONFIG.pool.connectionTimeoutMillis,
  };

  const newPool = new Pool(poolConfig);

  if (CONFIG.logging.enabled) {
    console.log(
      `[${getTimestamp()}] 🔧 Pool créé avec ${CONFIG.pool.max} connexions max`,
    );
  }

  // Gestion d'erreurs critiques uniquement
  newPool.on('error', (err, client) => {
    console.error(
      `[${getTimestamp()}] 🚨 Erreur critique du pool:`,
      err.message,
    );

    captureException(err, {
      tags: {
        component: 'database_pool',
        error_type: 'pool_error',
      },
      extra: {
        poolInfo: {
          totalCount: newPool.totalCount,
          idleCount: newPool.idleCount,
          waitingCount: newPool.waitingCount,
        },
      },
    });
  });

  // Events basiques en développement seulement
  if (CONFIG.logging.enabled) {
    newPool.on('connect', (client) => {
      console.log(
        `[${getTimestamp()}] 🔗 Nouvelle connexion (Total: ${newPool.totalCount})`,
      );
    });

    newPool.on('remove', (client) => {
      console.log(
        `[${getTimestamp()}] 🗑️ Connexion supprimée (Total: ${newPool.totalCount})`,
      );
    });
  }

  return newPool;
}

// =============================================
// HEALTH CHECK SIMPLE
// =============================================

async function performHealthCheck() {
  if (!pool) return { status: 'no_pool' };

  const startTime = Date.now();

  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT NOW() as current_time, version() as pg_version',
    );
    client.release();

    const responseTime = Date.now() - startTime;
    const pgVersion = result.rows[0].pg_version.split(' ')[0];

    if (CONFIG.logging.healthChecks) {
      console.log(
        `[${getTimestamp()}] 🏥 Health Check OK: ${responseTime}ms, PG ${pgVersion}`,
      );
    }

    return {
      status: 'healthy',
      responseTime,
      pgVersion,
      poolInfo: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[${getTimestamp()}] 🚨 Health Check échoué:`, error.message);

    captureException(error, {
      tags: {
        component: 'database_pool',
        error_type: 'health_check_failed',
      },
      extra: { responseTime: Date.now() - startTime },
    });

    return {
      status: 'unhealthy',
      error: error.message,
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}

// =============================================
// RECONNEXION SIMPLIFIÉE
// =============================================

async function reconnectPool(attempt = 1) {
  console.log(
    `[${getTimestamp()}] 🔄 Reconnexion tentative ${attempt}/${CONFIG.retry.maxAttempts}`,
  );

  // Arrêter le monitoring
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }

  // Fermer l'ancien pool
  try {
    if (pool) await pool.end();
  } catch (err) {
    if (CONFIG.logging.enabled) {
      console.warn(
        `[${getTimestamp()}] ⚠️ Erreur fermeture pool:`,
        err.message,
      );
    }
  }

  // Refresh config Doppler
  isConfigLoaded = false;
  dopplerConfig = null;

  try {
    pool = await createPool();

    // Test de connexion
    const client = await pool.connect();
    client.release();

    console.log(
      `[${getTimestamp()}] ✅ Reconnexion réussie (tentative ${attempt})`,
    );

    captureMessage(`Pool reconnecté avec succès (tentative ${attempt})`, {
      level: 'info',
      tags: { component: 'database_pool', operation: 'reconnection_success' },
      extra: { attempt, maxAttempts: CONFIG.retry.maxAttempts },
    });

    // Redémarrer le monitoring
    startHealthCheckMonitoring();
  } catch (error) {
    console.error(
      `[${getTimestamp()}] ❌ Reconnexion tentative ${attempt} échouée:`,
      error.message,
    );

    if (attempt < CONFIG.retry.maxAttempts) {
      setTimeout(() => reconnectPool(attempt + 1), CONFIG.retry.delay);
    } else {
      console.error(
        `[${getTimestamp()}] 🚨 Échec final après ${CONFIG.retry.maxAttempts} tentatives`,
      );

      captureMessage('Reconnexion finale échouée', {
        level: 'error',
        tags: { component: 'database_pool', error_type: 'reconnection_failed' },
        extra: {
          maxAttempts: CONFIG.retry.maxAttempts,
          lastError: error.message,
        },
      });
    }
  }
}

// =============================================
// MONITORING BASIQUE
// =============================================

function startHealthCheckMonitoring() {
  if (!CONFIG.monitoring.healthCheckInterval) return;

  healthCheckInterval = setInterval(async () => {
    const health = await performHealthCheck();

    // Alerte seulement si problème critique
    if (health.status === 'unhealthy') {
      console.error(`[${getTimestamp()}] 🚨 Base de données non disponible`);

      captureMessage('Database health check failed', {
        level: 'error',
        tags: { component: 'database_pool', issue_type: 'health_critical' },
        extra: health,
      });
    }
  }, CONFIG.monitoring.healthCheckInterval);

  if (CONFIG.logging.enabled) {
    console.log(
      `[${getTimestamp()}] 📊 Health check démarré (${CONFIG.monitoring.healthCheckInterval / 1000}s)`,
    );
  }
}

// =============================================
// 🔥 FONCTION D'INITIALISATION REFACTORISÉE
// =============================================

async function initializePool() {
  try {
    if (CONFIG.logging.enabled) {
      console.log(
        `[${getTimestamp()}] 🚀 Initialisation du pool PostgreSQL...`,
      );
    }

    pool = await createPool();

    // Test initial
    const client = await pool.connect();
    const testResult = await client.query(
      'SELECT NOW() as startup_time, version() as pg_version',
    );
    client.release();

    console.log(`[${getTimestamp()}] ✅ Connexion PostgreSQL établie`);
    if (CONFIG.logging.enabled) {
      console.log(
        `[${getTimestamp()}] 🐘 ${testResult.rows[0].pg_version.split(' ')[0]}`,
      );
    }

    captureMessage('Database pool initialized successfully', {
      level: 'info',
      tags: { component: 'database_pool', operation: 'initialization' },
      extra: {
        pgVersion: testResult.rows[0].pg_version.split(' ')[0],
        maxConnections: CONFIG.pool.max,
        environment: process.env.NODE_ENV,
      },
    });

    // Démarrer le monitoring
    setTimeout(() => {
      startHealthCheckMonitoring();
      if (CONFIG.logging.enabled) {
        console.log(`[${getTimestamp()}] ✅ Pool prêt avec monitoring`);
      }
    }, 1000);

    return pool;
  } catch (error) {
    console.error(
      `[${getTimestamp()}] ❌ Échec initialisation:`,
      error.message,
    );

    captureException(error, {
      tags: { component: 'database_pool', error_type: 'initialization_failed' },
      extra: { retryAction: 'attempting_reconnection' },
    });

    // Tentative de reconnexion
    setTimeout(() => reconnectPool(), 2000);
    throw error;
  }
}

// =============================================
// 🔥 CLIENT MANAGEMENT AVEC ATTENTE
// =============================================

export const getClient = async () => {
  // 🔥 ATTENDRE QUE L'INITIALISATION SOIT TERMINÉE
  if (!initializationPromise) {
    initializationPromise = initializePool();
  }

  await initializationPromise;

  // Maintenant on est sûr que pool existe
  if (!pool) {
    throw new Error('Pool non initialisé après attente');
  }

  const startTime = Date.now();

  try {
    const client = await pool.connect();
    const acquisitionTime = Date.now() - startTime;

    // Log seulement si lent (>500ms) ou en dev
    if (acquisitionTime > 500 || CONFIG.logging.enabled) {
      console.log(
        `[${getTimestamp()}] ✅ Client acquis en ${acquisitionTime}ms`,
      );
    }

    // Alerte si très lent (>2s)
    if (acquisitionTime > 2000) {
      captureMessage(`Acquisition client lente: ${acquisitionTime}ms`, {
        level: 'warning',
        tags: { component: 'database_pool', issue_type: 'slow_acquisition' },
        extra: {
          acquisitionTime,
          poolInfo: {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
          },
        },
      });
    }

    return client;
  } catch (error) {
    const acquisitionTime = Date.now() - startTime;
    console.error(
      `[${getTimestamp()}] ❌ Erreur acquisition client (${acquisitionTime}ms):`,
      error.message,
    );

    captureException(error, {
      tags: {
        component: 'database_pool',
        error_type: 'client_acquisition_failed',
      },
      extra: { acquisitionTime },
    });

    throw new Error('Erreur de connexion base de données');
  }
};

// =============================================
// GRACEFUL SHUTDOWN
// =============================================

async function shutdown() {
  console.log(`[${getTimestamp()}] 🛑 Arrêt du pool...`);

  // Arrêter le monitoring
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  try {
    if (pool) {
      await pool.end();
      console.log(`[${getTimestamp()}] ✅ Pool fermé proprement`);

      captureMessage('Database pool shutdown completed', {
        level: 'info',
        tags: { component: 'database_pool', operation: 'shutdown' },
      });
    }
  } catch (error) {
    console.error(
      `[${getTimestamp()}] ❌ Erreur fermeture pool:`,
      error.message,
    );
    captureException(error, {
      tags: { component: 'database_pool', error_type: 'shutdown_error' },
    });
  }
}

// Handlers de signaux
process.on('SIGINT', () => {
  console.log(`[${getTimestamp()}] 🛑 SIGINT reçu`);
  shutdown().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log(`[${getTimestamp()}] 🛑 SIGTERM reçu`);
  shutdown().then(() => process.exit(0));
});

// =============================================
// EXPORTS
// =============================================

export default pool;

// API de monitoring simplifiée
export const monitoring = {
  // Informations basiques du pool
  getPoolInfo: () => ({
    total: pool?.totalCount || 0,
    idle: pool?.idleCount || 0,
    waiting: pool?.waitingCount || 0,
    maxConnections: CONFIG.pool.max,
  }),

  // Health check manuel
  performHealthCheck,

  // Configuration actuelle
  getConfig: () => ({
    environment: process.env.NODE_ENV,
    maxConnections: CONFIG.pool.max,
    healthCheckInterval: CONFIG.monitoring.healthCheckInterval,
    loggingEnabled: CONFIG.logging.enabled,
  }),

  // Statistiques simples
  getStats: () => ({
    poolInfo: monitoring.getPoolInfo(),
    config: monitoring.getConfig(),
    dopplerConfigLoaded: isConfigLoaded,
    timestamp: new Date().toISOString(),
  }),
};
