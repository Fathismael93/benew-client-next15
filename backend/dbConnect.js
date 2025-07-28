/**************** *********************/

// CONNECTION POOLING WITH MONITORING - SENTRY V9 - OPTIMIZED

/***************** ********************/

import { Pool } from 'pg';
import logger from '@utils/logger';
import { captureMessage, captureDatabaseError } from '../instrumentation.js';
import { initializeBenewConfig } from '@/utils/doppler';
import * as Sentry from '@sentry/nextjs';

// =============================================
// UTILITAIRES SENTRY INTÉGRÉS
// =============================================

/**
 * Détecte les données sensibles spécifiques à la DB
 */
function containsSensitiveData(str) {
  if (!str || typeof str !== 'string') return false;

  const patterns = [
    /password/i,
    /mot\s*de\s*passe/i,
    /account[_-]?number/i,
    /payment[_-]?method/i,
    /db[_-]?password/i,
    /database[_-]?password/i,
    /connection[_-]?string/i,
    /db[_-]?ca/i,
    /sentry[_-]?dsn/i,
    /client[_-]?email/i,
    /client[_-]?phone/i,
    /\b(?:\d{4}[ -]?){3}\d{4}\b/, // Numéros de carte
    /\b(?:\d{3}[ -]?){2}\d{4}\b/, // Numéros de téléphone
    /\b\d{8,}\b/, // Numéros de compte génériques
  ];

  return patterns.some((pattern) => pattern.test(str));
}

/**
 * Classification des erreurs de base de données
 */
function categorizeDatabaseError(error) {
  if (!error) return 'unknown';

  const message = error.message || '';
  const name = error.name || '';
  const code = error.code || '';
  const combinedText = (message + name + code).toLowerCase();

  if (/connection|connect|timeout|econnrefused|enotfound/i.test(combinedText)) {
    return 'db_connection';
  }
  if (/pool|acquire|release|client/i.test(combinedText)) {
    return 'db_pool';
  }
  if (/query|syntax|sql|invalid/i.test(combinedText)) {
    return 'db_query';
  }
  if (/permission|auth|access|denied/i.test(combinedText)) {
    return 'db_permission';
  }
  if (/network|socket|hang|reset/i.test(combinedText)) {
    return 'db_network';
  }

  return 'db_general';
}

/**
 * Anonymise les données d'utilisateur dans les logs DB
 */
function anonymizeUserData(userData) {
  if (!userData || typeof userData !== 'object') return userData;

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

/**
 * Filtre les requêtes SQL sensibles
 */
function filterSQLQuery(query) {
  if (!query || typeof query !== 'string') return query;

  if (containsSensitiveData(query)) {
    // Masquer les valeurs dans les requêtes SQL
    return query.replace(
      /(password|token|secret|account_number|email|phone)\s*=\s*['"][^'"]*['"]/gi,
      "$1 = '[FILTERED]'",
    );
  }

  return query;
}

/**
 * Capture spécialisée pour les erreurs de base de données
 */
function captureEnhancedDatabaseError(error, context = {}) {
  const dbContext = {
    tags: {
      error_category: categorizeDatabaseError(error),
      database_type: 'postgresql',
      component: 'database_pool',
      ...context.tags,
    },
    extra: {
      postgres_code: error.code,
      table: context.table || 'unknown',
      operation: context.operation || 'unknown',
      query_type: context.queryType || 'unknown',
      duration: context.duration,
      poolMetrics: context.poolMetrics,
      ...context.extra,
    },
    level: 'error',
  };

  // Filtrer les informations sensibles de la DB
  if (dbContext.extra.query) {
    dbContext.extra.query = filterSQLQuery(dbContext.extra.query);
  }

  // Anonymiser les données utilisateur si présentes
  if (context.userData) {
    dbContext.extra.userData = anonymizeUserData(context.userData);
  }

  captureDatabaseError(error, dbContext);
}

// Configuration simplifiée
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

const CONFIG = {
  retries: { max: 5, delay: 5000 },
  intervals: {
    metrics: isProduction ? 300000 : 60000, // 5min prod / 1min dev
    health: isProduction ? 600000 : 120000, // 10min prod / 2min dev
  },
  thresholds: {
    waitingCount: isProduction ? 10 : 5,
    acquisitionTime: isProduction ? 2000 : 1000,
    utilizationRate: 0.85,
    slowAcquisition: 500,
  },
  logging: {
    events: isDevelopment,
    acquisitions: isDevelopment,
    breadcrumbs: isDevelopment ? 'all' : 'errors_only',
  },
};

// Configuration Doppler
let dopplerConfig = null;
let isConfigLoaded = false;

const getTimestamp = () => new Date().toISOString();

// Validation des variables d'environnement critiques
const requiredEnvVars = [
  'USER_NAME',
  'HOST_NAME',
  'DB_NAME',
  'DB_PASSWORD',
  'PORT_NUMBER',
  'CONNECTION_TIMEOUT',
  'MAXIMUM_CLIENTS',
  'CLIENT_EXISTENCE',
  'DB_CA',
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    if (isDevelopment) {
      logger.warn('Missing environment variable', {
        timestamp: getTimestamp(),
        variable: envVar,
        component: 'database_pool',
      });
    }

    captureMessage(`Missing database environment variable: ${envVar}`, {
      level: 'warning',
      tags: {
        component: 'database_pool',
        issue_type: 'missing_env_var',
        env_var: envVar,
      },
    });
  }
});

let pool;
let metricsInterval;
let healthCheckInterval;

// Load Doppler configuration
async function loadDopplerConfig() {
  if (dopplerConfig && isConfigLoaded) return dopplerConfig;

  try {
    const benewConfig = await initializeBenewConfig();
    dopplerConfig = benewConfig.database;
    isConfigLoaded = true;

    if (isDevelopment) {
      console.log(
        `[${getTimestamp()}] ✅ Doppler database configuration loaded successfully`,
      );
    }
    return dopplerConfig;
  } catch (error) {
    if (isDevelopment) {
      console.error(
        `[${getTimestamp()}] ❌ Failed to load Doppler config:`,
        error.message,
      );
    }

    // Fallback vers les variables d'environnement
    dopplerConfig = {
      username: process.env.USER_NAME,
      host: process.env.HOST_NAME,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: Number(process.env.PORT_NUMBER) || 5432,
      connectionTimeout: Number(process.env.CONNECTION_TIMEOUT) || 5000,
      maxClients: Number(process.env.MAXIMUM_CLIENTS) || 10,
      ssl: process.env.DB_CA ? { ca: process.env.DB_CA } : false,
    };

    isConfigLoaded = true;
    return dopplerConfig;
  }
}

// =============================================
// POOL METRICS & MONITORING - OPTIMIZED
// =============================================

class PoolMetrics {
  constructor() {
    this.connectionAcquisitionTimes = [];
    this.maxAcquisitionTimeHistory = 50;
    this.alertThresholds = CONFIG.thresholds;
    this.lastMetrics = null;
  }

  collectMetrics() {
    if (!pool) return null;

    const metrics = {
      timestamp: new Date().toISOString(),
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      utilizationRate:
        pool.totalCount > 0
          ? (pool.totalCount - pool.idleCount) / pool.totalCount
          : 0,
      maxConnections: dopplerConfig?.maxClients || 10,
    };

    if (this.connectionAcquisitionTimes.length > 0) {
      metrics.avgAcquisitionTime =
        this.connectionAcquisitionTimes.reduce((a, b) => a + b, 0) /
        this.connectionAcquisitionTimes.length;
      metrics.maxAcquisitionTime = Math.max(...this.connectionAcquisitionTimes);
    }

    this.lastMetrics = metrics;
    return metrics;
  }

  recordAcquisitionTime(timeMs) {
    this.connectionAcquisitionTimes.push(timeMs);
    if (
      this.connectionAcquisitionTimes.length > this.maxAcquisitionTimeHistory
    ) {
      this.connectionAcquisitionTimes.shift();
    }
  }

  analyzeMetrics(metrics) {
    const alerts = [];

    if (metrics.waitingCount > this.alertThresholds.waitingCount) {
      alerts.push({
        level: 'critical',
        type: 'pool_saturation',
        message: `High waiting queue: ${metrics.waitingCount} requests waiting`,
        metric: 'waitingCount',
        value: metrics.waitingCount,
        threshold: this.alertThresholds.waitingCount,
      });
    }

    if (metrics.idleCount === 0 && metrics.totalCount > 0) {
      alerts.push({
        level: 'warning',
        type: 'no_idle_connections',
        message: 'No idle connections available',
        metric: 'idleCount',
        value: metrics.idleCount,
      });
    }

    if (metrics.utilizationRate > this.alertThresholds.utilizationRate) {
      alerts.push({
        level: 'warning',
        type: 'high_utilization',
        message: `High pool utilization: ${(metrics.utilizationRate * 100).toFixed(1)}%`,
        metric: 'utilizationRate',
        value: metrics.utilizationRate,
        threshold: this.alertThresholds.utilizationRate,
      });
    }

    if (metrics.avgAcquisitionTime > this.alertThresholds.acquisitionTime) {
      alerts.push({
        level: 'warning',
        type: 'slow_acquisition',
        message: `Slow connection acquisition: ${metrics.avgAcquisitionTime.toFixed(0)}ms avg`,
        metric: 'avgAcquisitionTime',
        value: metrics.avgAcquisitionTime,
        threshold: this.alertThresholds.acquisitionTime,
      });
    }

    return alerts;
  }

  getHealthStatus(metrics) {
    const alerts = this.analyzeMetrics(metrics);
    const criticalAlerts = alerts.filter((a) => a.level === 'critical');
    const warningAlerts = alerts.filter((a) => a.level === 'warning');

    let status = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (warningAlerts.length > 0) {
      status = 'warning';
    }

    return {
      status,
      alerts,
      summary: {
        total: alerts.length,
        critical: criticalAlerts.length,
        warning: warningAlerts.length,
      },
    };
  }

  exportMetrics(metrics, health) {
    return {
      'pool.total_connections': metrics.totalCount,
      'pool.idle_connections': metrics.idleCount,
      'pool.waiting_requests': metrics.waitingCount,
      'pool.utilization_rate': metrics.utilizationRate,
      'pool.avg_acquisition_time_ms': metrics.avgAcquisitionTime || 0,
      'pool.max_acquisition_time_ms': metrics.maxAcquisitionTime || 0,
      'pool.health_status': health.status,
      'pool.alert_count': health.summary.total,
    };
  }
}

const poolMetrics = new PoolMetrics();

// Logging optimisé des métriques
function logPoolMetrics() {
  const metrics = poolMetrics.collectMetrics();
  if (!metrics) return;

  const health = poolMetrics.getHealthStatus(metrics);

  // Log seulement si problèmes détectés ou en développement
  if (health.alerts.length > 0 || isDevelopment) {
    if (isDevelopment) {
      // Filtrer les logs de développement pour données sensibles
      const poolInfo =
        `Pool: Total=${metrics.totalCount}, Idle=${metrics.idleCount}, ` +
        `Waiting=${metrics.waitingCount}, Util=${(metrics.utilizationRate * 100).toFixed(1)}%`;

      console.log(`[${getTimestamp()}] 📊 ${poolInfo}`);

      if (metrics.avgAcquisitionTime !== undefined) {
        const perfInfo = `Performance: Avg=${metrics.avgAcquisitionTime.toFixed(0)}ms, Max=${metrics.maxAcquisitionTime.toFixed(0)}ms`;
        console.log(`[${getTimestamp()}] ⏱️ ${perfInfo}`);
      }
    }

    // Log des alertes (toujours) avec filtrage
    if (health.alerts.length > 0) {
      health.alerts.forEach((alert) => {
        const emoji = alert.level === 'critical' ? '🚨' : '⚠️';
        const filteredMessage = containsSensitiveData(alert.message)
          ? '[Alert message filtered for security]'
          : alert.message;
        console.warn(
          `[${getTimestamp()}] ${emoji} Pool Alert [${alert.level.toUpperCase()}]: ${filteredMessage}`,
        );
      });
    }
  }

  const exportedMetrics = poolMetrics.exportMetrics(metrics, health);

  // Sentry : Seulement pour les problèmes critiques avec filtrage
  if (health.status === 'critical') {
    const filteredAlerts = health.alerts.map((alert) => ({
      ...alert,
      message: containsSensitiveData(alert.message)
        ? '[Alert filtered for security]'
        : alert.message,
    }));

    captureMessage(
      `Critical Database Pool Issue: ${filteredAlerts.map((a) => a.message).join(', ')}`,
      {
        level: 'error',
        tags: {
          component: 'database_pool',
          issue_type: 'pool_critical',
          pool_status: health.status,
        },
        extra: exportedMetrics,
      },
    );
  }

  // Performance dégradée seulement si très lent
  if (metrics.avgAcquisitionTime > (isProduction ? 3000 : 2000)) {
    captureMessage(
      `Slow database pool performance: ${metrics.avgAcquisitionTime.toFixed(0)}ms average acquisition time`,
      {
        level: 'warning',
        tags: {
          component: 'database_pool',
          issue_type: 'performance_degradation',
        },
        extra: exportedMetrics,
      },
    );
  }
}

// Health check optimisé
async function performHealthCheck() {
  const startTime = Date.now();

  try {
    const client = await pool.connect();
    const queryResult = await client.query(
      'SELECT NOW() as current_time, version() as pg_version',
    );
    client.release();

    const responseTime = Date.now() - startTime;
    poolMetrics.recordAcquisitionTime(responseTime);

    if (isDevelopment) {
      const metrics = poolMetrics.collectMetrics();
      const health = poolMetrics.getHealthStatus(metrics);
      console.log(
        `[${getTimestamp()}] 🏥 Health Check: DB=${responseTime}ms, Pool=${health.status}, ` +
          `PG=${queryResult.rows[0].pg_version.split(' ')[0]}`,
      );
    }

    return {
      status: 'healthy',
      responseTime,
      database: 'connected',
      postgresql_version: queryResult.rows[0].pg_version.split(' ')[0],
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[${getTimestamp()}] 🚨 Health Check Failed:`, error.message);

    captureDatabaseError(error, {
      tags: { issue_type: 'health_check_failed', operation: 'health_check' },
      extra: {
        responseTime: Date.now() - startTime,
        poolMetrics: poolMetrics.collectMetrics(),
      },
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
// POOL MANAGEMENT - OPTIMIZED
// =============================================

const createPool = async () => {
  const config = await loadDopplerConfig();

  pool = new Pool({
    user: config.username,
    host: config.host,
    database: config.database,
    password: config.password,
    port: Number(config.port) || 5432,
    connectionTimeoutMillis: Number(config.connectionTimeout) || 5000,
    max: Number(config.maxClients) || 10,
    idleTimeoutMillis: Number(process.env.CLIENT_EXISTENCE) || 30000,
    ssl: config.ssl || false,
  });

  if (isDevelopment) {
    console.log(
      `[${getTimestamp()}] 🔧 Pool created with Doppler configuration`,
    );
  }

  // Gestion d'erreurs critiques uniquement avec filtrage Sentry
  pool.on('error', (err, client) => {
    const errorMessage = containsSensitiveData(err.message)
      ? '[Pool error message filtered for security]'
      : err.message;

    console.error(
      `[${getTimestamp()}] 🚨 Unexpected database pool error:`,
      errorMessage,
    );

    const metrics = poolMetrics.collectMetrics();
    if (metrics && isDevelopment) {
      console.error(
        `[${getTimestamp()}] 📊 Pool state during error: ` +
          `Total=${metrics.totalCount}, Idle=${metrics.idleCount}, Waiting=${metrics.waitingCount}`,
      );
    }

    captureEnhancedDatabaseError(err, {
      tags: { issue_type: 'pool_error', operation: 'pool_event' },
      extra: {
        poolMetrics: metrics,
        clientInfo: client ? 'client_provided' : 'no_client',
      },
    });
  });

  // Events de pool : seulement en développement ou erreurs
  if (CONFIG.logging.events) {
    pool.on('connect', () => {
      console.log(`[${getTimestamp()}] 🔗 New client connected to pool`);
    });

    pool.on('acquire', () => {
      console.log(`[${getTimestamp()}] 📤 Client acquired from pool`);
    });

    pool.on('remove', () => {
      console.log(`[${getTimestamp()}] 🗑️ Client removed from pool`);
    });
  }

  pool.on('release', (err) => {
    if (err) {
      const errorMessage = containsSensitiveData(err.message)
        ? '[Client release error filtered for security]'
        : err.message;

      console.error(
        `[${getTimestamp()}] ❌ Client release error:`,
        errorMessage,
      );

      captureEnhancedDatabaseError(err, {
        tags: { issue_type: 'client_release_error', operation: 'pool_release' },
        extra: { poolMetrics: poolMetrics.collectMetrics() },
      });
    } else if (CONFIG.logging.events) {
      console.log(`[${getTimestamp()}] 📥 Client released back to pool`);
    }
  });

  return pool;
};

pool = await createPool();

// =============================================
// MONITORING INTERVALS - OPTIMIZED
// =============================================

function startMonitoring() {
  metricsInterval = setInterval(logPoolMetrics, CONFIG.intervals.metrics);
  healthCheckInterval = setInterval(
    performHealthCheck,
    CONFIG.intervals.health,
  );

  if (isDevelopment) {
    console.log(
      `[${getTimestamp()}] 📊 Pool monitoring started (metrics: ${CONFIG.intervals.metrics / 1000}s, health: ${CONFIG.intervals.health / 1000}s)`,
    );
  }
}

function stopMonitoring() {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }

  if (isDevelopment) {
    console.log(`[${getTimestamp()}] 📊 Pool monitoring stopped`);
  }
}

// =============================================
// RECONNECTION LOGIC - OPTIMIZED
// =============================================

const reconnectPool = async (attempt = 1) => {
  console.log(
    `[${getTimestamp()}] 🔄 Attempting to reconnect pool... (Attempt ${attempt}/${CONFIG.retries.max})`,
  );

  stopMonitoring();

  try {
    await pool.end();
  } catch (err) {
    if (isDevelopment) {
      console.error(
        `[${getTimestamp()}] ⚠️ Error closing existing pool:`,
        err.message,
      );
    }
  }

  // Refresh Doppler config
  isConfigLoaded = false;
  dopplerConfig = null;

  try {
    pool = await createPool();
    const client = await pool.connect();
    console.log(
      `[${getTimestamp()}] ✅ Pool reconnected successfully on attempt ${attempt}`,
    );
    client.release();

    captureMessage(
      `Database pool reconnected successfully on attempt ${attempt}`,
      {
        level: 'info',
        tags: {
          component: 'database_pool',
          issue_type: 'reconnection_success',
        },
        extra: { attempt, maxRetries: CONFIG.retries.max },
      },
    );

    startMonitoring();
    setTimeout(logPoolMetrics, 1000);
  } catch (err) {
    console.error(
      `[${getTimestamp()}] ❌ Pool reconnection attempt ${attempt} failed:`,
      err.message,
    );

    captureEnhancedDatabaseError(err, {
      tags: {
        issue_type: 'reconnection_attempt_failed',
        operation: 'pool_reconnect',
      },
      extra: {
        attempt,
        maxRetries: CONFIG.retries.max,
        remainingAttempts: CONFIG.retries.max - attempt,
      },
    });

    if (attempt < CONFIG.retries.max) {
      setTimeout(() => reconnectPool(attempt + 1), CONFIG.retries.delay);
    } else {
      console.error(
        `[${getTimestamp()}] 🚨 Maximum reconnection attempts reached. Pool is unavailable.`,
      );

      captureMessage('Database pool reconnection failed after max retries', {
        level: 'error',
        tags: {
          component: 'database_pool',
          issue_type: 'reconnection_failed_final',
        },
        extra: {
          maxRetries: CONFIG.retries.max,
          lastAttempt: attempt,
          retryDelay: CONFIG.retries.delay,
        },
      });
    }
  }
};

// =============================================
// CLIENT MANAGEMENT - OPTIMIZED
// =============================================

export const getClient = async () => {
  const acquisitionStart = Date.now();

  try {
    const client = await pool.connect();
    const acquisitionTime = Date.now() - acquisitionStart;

    poolMetrics.recordAcquisitionTime(acquisitionTime);

    // Log seulement si lent ou en développement
    if (acquisitionTime > CONFIG.thresholds.slowAcquisition || isDevelopment) {
      console.log(
        `[${getTimestamp()}] ✅ Database client acquired in ${acquisitionTime}ms`,
      );
    }

    // Avertissement pour acquisition lente avec filtrage
    if (acquisitionTime > CONFIG.thresholds.slowAcquisition) {
      const warningMessage = `Slow client acquisition: ${acquisitionTime}ms`;
      console.warn(`[${getTimestamp()}] ⚠️ ${warningMessage}`);

      captureMessage(`Slow database client acquisition: ${acquisitionTime}ms`, {
        level: 'warning',
        tags: {
          component: 'database_pool',
          issue_type: 'slow_client_acquisition',
        },
        extra: {
          acquisitionTime,
          threshold: CONFIG.thresholds.slowAcquisition,
          poolMetrics: poolMetrics.collectMetrics(),
        },
      });
    }

    return client;
  } catch (err) {
    const acquisitionTime = Date.now() - acquisitionStart;
    const errorMessage = containsSensitiveData(err.message)
      ? '[Database client acquisition error filtered]'
      : err.message;

    console.error(
      `[${getTimestamp()}] ❌ Error acquiring database client after ${acquisitionTime}ms:`,
      errorMessage,
    );

    const metrics = poolMetrics.collectMetrics();
    if (metrics && isDevelopment) {
      console.error(
        `[${getTimestamp()}] 📊 Pool state during error: ` +
          `Total=${metrics.totalCount}, Idle=${metrics.idleCount}, Waiting=${metrics.waitingCount}`,
      );
    }

    captureEnhancedDatabaseError(err, {
      tags: {
        issue_type: 'client_acquisition_failed',
        operation: 'get_client',
      },
      extra: { acquisitionTime, poolMetrics: metrics },
    });

    throw new Error('Database connection error');
  }
};

// =============================================
// INITIALIZATION & CLEANUP - OPTIMIZED
// =============================================

(async () => {
  try {
    if (isDevelopment) {
      console.log(
        `[${getTimestamp()}] 🚀 Starting database pool initialization...`,
      );
    }

    const client = await pool.connect();
    const testResult = await client.query(
      'SELECT NOW() as startup_time, version() as pg_version',
    );

    console.log(
      `[${getTimestamp()}] ✅ Initial database connection test successful`,
    );
    if (isDevelopment) {
      console.log(
        `[${getTimestamp()}] 🐘 PostgreSQL: ${testResult.rows[0].pg_version.split(' ')[0]}`,
      );
      console.log(
        `[${getTimestamp()}] ⏰ Server time: ${testResult.rows[0].startup_time}`,
      );
    }

    client.release();

    captureMessage('Database pool initialized successfully', {
      level: 'info',
      tags: {
        component: 'database_pool',
        issue_type: 'initialization_success',
      },
      extra: {
        postgresqlVersion: testResult.rows[0].pg_version.split(' ')[0],
        serverTime: testResult.rows[0].startup_time,
      },
    });

    setTimeout(() => {
      startMonitoring();
      if (isDevelopment) {
        console.log(
          `[${getTimestamp()}] ✅ Database pool ready with monitoring enabled`,
        );
      }
    }, 1000);
  } catch (err) {
    console.error(
      `[${getTimestamp()}] ❌ Initial database connection test failed. Attempting to reconnect...`,
    );
    if (isDevelopment) {
      console.error(err);
    }

    captureEnhancedDatabaseError(err, {
      tags: { issue_type: 'initialization_failed', operation: 'startup_test' },
      extra: { retryAction: 'attempting_reconnection' },
    });

    reconnectPool();
  }
})();

// Graceful shutdown optimisé
const shutdown = async () => {
  console.log(
    `[${getTimestamp()}] 🛑 Initiating graceful database pool shutdown...`,
  );

  stopMonitoring();

  const finalMetrics = poolMetrics.collectMetrics();
  if (finalMetrics && isDevelopment) {
    console.log(
      `[${getTimestamp()}] 📊 Final pool metrics: ` +
        `Total=${finalMetrics.totalCount}, Idle=${finalMetrics.idleCount}, Waiting=${finalMetrics.waitingCount}`,
    );
  }

  try {
    await pool.end();
    console.log(`[${getTimestamp()}] ✅ Database pool closed gracefully`);

    captureMessage('Database pool shutdown completed successfully', {
      level: 'info',
      tags: { component: 'database_pool', issue_type: 'shutdown_success' },
    });
  } catch (err) {
    const errorMessage = containsSensitiveData(err.message)
      ? '[Database shutdown error filtered]'
      : err.message;

    console.error(
      `[${getTimestamp()}] ❌ Error closing database pool:`,
      errorMessage,
    );

    captureEnhancedDatabaseError(err, {
      tags: { issue_type: 'shutdown_error', operation: 'pool_end' },
    });
  }
};

process.on('SIGINT', () => {
  console.log(
    `[${getTimestamp()}] 🛑 Received SIGINT signal, shutting down...`,
  );
  shutdown().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log(
    `[${getTimestamp()}] 🛑 Received SIGTERM signal, shutting down...`,
  );
  shutdown().then(() => process.exit(0));
});

// =============================================
// EXPORTS & API - SIMPLIFIED
// =============================================

export default pool;

export const monitoring = {
  getMetrics: () => poolMetrics.collectMetrics(),
  getHealth: () => {
    const metrics = poolMetrics.collectMetrics();
    return metrics ? poolMetrics.getHealthStatus(metrics) : null;
  },
  performHealthCheck,
  getPoolInstance: () => pool,
  getDopplerConfig: () => dopplerConfig,
  refreshDopplerConfig: async () => {
    isConfigLoaded = false;
    dopplerConfig = null;
    return await loadDopplerConfig();
  },
};
