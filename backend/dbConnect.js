/**************** *********************/

// CONNECTION POOLING WITH MONITORING - SENTRY V9 - OPTIMIZED

/***************** ********************/

import { Pool } from 'pg';
import logger from '@/utils/logger';
import { captureMessage, captureDatabaseError } from '../instrumentation.js';
import { initializeBenewConfig } from '@/utils/doppler';

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
      console.log(
        `[${getTimestamp()}] 📊 Pool: Total=${metrics.totalCount}, Idle=${metrics.idleCount}, ` +
          `Waiting=${metrics.waitingCount}, Util=${(metrics.utilizationRate * 100).toFixed(1)}%`,
      );

      if (metrics.avgAcquisitionTime !== undefined) {
        console.log(
          `[${getTimestamp()}] ⏱️ Performance: Avg=${metrics.avgAcquisitionTime.toFixed(0)}ms, Max=${metrics.maxAcquisitionTime.toFixed(0)}ms`,
        );
      }
    }

    // Log des alertes (toujours)
    if (health.alerts.length > 0) {
      health.alerts.forEach((alert) => {
        const emoji = alert.level === 'critical' ? '🚨' : '⚠️';
        console.warn(
          `[${getTimestamp()}] ${emoji} Pool Alert [${alert.level.toUpperCase()}]: ${alert.message}`,
        );
      });
    }
  }

  const exportedMetrics = poolMetrics.exportMetrics(metrics, health);

  // Sentry : Seulement pour les problèmes critiques
  if (health.status === 'critical') {
    captureMessage(
      `Critical Database Pool Issue: ${health.alerts.map((a) => a.message).join(', ')}`,
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

  // Gestion d'erreurs critiques uniquement
  pool.on('error', (err, client) => {
    console.error(
      `[${getTimestamp()}] 🚨 Unexpected database pool error:`,
      err.message,
    );

    const metrics = poolMetrics.collectMetrics();
    if (metrics && isDevelopment) {
      console.error(
        `[${getTimestamp()}] 📊 Pool state during error: ` +
          `Total=${metrics.totalCount}, Idle=${metrics.idleCount}, Waiting=${metrics.waitingCount}`,
      );
    }

    captureDatabaseError(err, {
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
      console.error(
        `[${getTimestamp()}] ❌ Client release error:`,
        err.message,
      );

      captureDatabaseError(err, {
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

    captureDatabaseError(err, {
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

    // Avertissement pour acquisition lente
    if (acquisitionTime > CONFIG.thresholds.slowAcquisition) {
      console.warn(
        `[${getTimestamp()}] ⚠️ Slow client acquisition: ${acquisitionTime}ms`,
      );

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
    console.error(
      `[${getTimestamp()}] ❌ Error acquiring database client after ${acquisitionTime}ms:`,
      err.message,
    );

    const metrics = poolMetrics.collectMetrics();
    if (metrics && isDevelopment) {
      console.error(
        `[${getTimestamp()}] 📊 Pool state during error: ` +
          `Total=${metrics.totalCount}, Idle=${metrics.idleCount}, Waiting=${metrics.waitingCount}`,
      );
    }

    captureDatabaseError(err, {
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

    captureDatabaseError(err, {
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
    console.error(
      `[${getTimestamp()}] ❌ Error closing database pool:`,
      err.message,
    );

    captureDatabaseError(err, {
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
