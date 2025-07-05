/**************** *********************/

// CONNECTION POOLING WITH MONITORING

/***************** ********************/

import { Pool } from 'pg';
import logger from '@utils/logger';
import { captureException, captureMessage } from 'instrumentation';

const MAX_RETRIES = 5; // Max reconnection attempts
const RETRY_DELAY = 5000; // Delay between retries (in ms)
const METRICS_INTERVAL = 30000; // Pool metrics logging interval (30s)
const HEALTH_CHECK_INTERVAL = 60000; // Health check interval (60s)

// Helper function to get formatted timestamp
const getTimestamp = () => new Date().toISOString();

// List of required environment variables
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

// Warn if any environment variables are missing
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    logger.warn('Missing environment variable', {
      timestamp: getTimestamp(),
      variable: envVar,
      component: 'database_pool',
      action: 'env_validation',
    });
  }
});

let pool;
let metricsInterval;
let healthCheckInterval;

// =============================================
// POOL METRICS & MONITORING
// =============================================

/**
 * Pool metrics collector and analyzer
 */
class PoolMetrics {
  constructor() {
    this.connectionAcquisitionTimes = [];
    this.maxAcquisitionTimeHistory = 50; // Keep last 50 measurements
    this.alertThresholds = {
      waitingCount: 5, // Alert if > 5 waiting requests
      idleCount: 0, // Alert if no idle connections
      acquisitionTime: 1000, // Alert if > 1s to get connection
      utilizationRate: 0.9, // Alert if > 90% utilization
    };
    this.lastMetrics = null;
  }

  /**
   * Collect current pool metrics
   */
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
      maxConnections: Number(process.env.MAXIMUM_CLIENTS) || 10,
    };

    // Calculate average acquisition time from recent measurements
    if (this.connectionAcquisitionTimes.length > 0) {
      metrics.avgAcquisitionTime =
        this.connectionAcquisitionTimes.reduce((a, b) => a + b, 0) /
        this.connectionAcquisitionTimes.length;
      metrics.maxAcquisitionTime = Math.max(...this.connectionAcquisitionTimes);
    }

    this.lastMetrics = metrics;
    return metrics;
  }

  /**
   * Record connection acquisition time
   */
  recordAcquisitionTime(timeMs) {
    this.connectionAcquisitionTimes.push(timeMs);

    // Keep only recent measurements
    if (
      this.connectionAcquisitionTimes.length > this.maxAcquisitionTimeHistory
    ) {
      this.connectionAcquisitionTimes.shift();
    }
  }

  /**
   * Check if metrics indicate problems and return alerts
   */
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

    if (
      metrics.idleCount === this.alertThresholds.idleCount &&
      metrics.totalCount > 0
    ) {
      alerts.push({
        level: 'warning',
        type: 'no_idle_connections',
        message: 'No idle connections available',
        metric: 'idleCount',
        value: metrics.idleCount,
        threshold: this.alertThresholds.idleCount,
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

  /**
   * Get pool health status
   */
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

  /**
   * Export metrics for external monitoring systems (Sentry, Prometheus, etc.)
   */
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

// Initialize metrics collector
const poolMetrics = new PoolMetrics();

/**
 * Log pool metrics with analysis
 */
function logPoolMetrics() {
  const metrics = poolMetrics.collectMetrics();
  if (!metrics) return;

  const health = poolMetrics.getHealthStatus(metrics);

  // Base metrics log
  console.log(
    `[${getTimestamp()}] 📊 Pool Metrics: ` +
      `Total=${metrics.totalCount}, Idle=${metrics.idleCount}, ` +
      `Waiting=${metrics.waitingCount}, Utilization=${(metrics.utilizationRate * 100).toFixed(1)}%`,
  );

  if (metrics.avgAcquisitionTime !== undefined) {
    console.log(
      `[${getTimestamp()}] ⏱️ Connection Performance: ` +
        `Avg=${metrics.avgAcquisitionTime.toFixed(0)}ms, Max=${metrics.maxAcquisitionTime.toFixed(0)}ms`,
    );
  }

  // Log alerts if any
  if (health.alerts.length > 0) {
    health.alerts.forEach((alert) => {
      const emoji = alert.level === 'critical' ? '🚨' : '⚠️';
      console.warn(
        `[${getTimestamp()}] ${emoji} Pool Alert [${alert.level.toUpperCase()}]: ${alert.message}`,
      );
    });
  }

  // Log health summary
  const healthEmoji =
    health.status === 'healthy'
      ? '✅'
      : health.status === 'warning'
        ? '⚠️'
        : '🚨';
  console.log(
    `[${getTimestamp()}] ${healthEmoji} Pool Health: ${health.status.toUpperCase()} ` +
      `(${health.summary.critical} critical, ${health.summary.warning} warnings)`,
  );

  // Export metrics for external monitoring
  const exportedMetrics = poolMetrics.exportMetrics(metrics, health);

  // Send to Sentry if available (optional integration)
  if (typeof global !== 'undefined' && global.Sentry) {
    global.Sentry.addBreadcrumb({
      category: 'db.pool.metrics',
      message: 'Pool metrics collected',
      level: health.status === 'healthy' ? 'info' : 'warning',
      data: exportedMetrics,
    });

    // Send critical alerts as Sentry events
    if (health.status === 'critical') {
      captureMessage(
        `Critical Pool Issue: ${health.alerts.map((a) => a.message).join(', ')}`,
        {
          level: 'error',
          tags: {
            component: 'database_pool',
            issue_type: 'pool_critical',
          },
          extra: exportedMetrics,
        },
      );
    }
  }
}

/**
 * Perform comprehensive pool health check
 */
async function performHealthCheck() {
  const startTime = Date.now();

  try {
    const client = await pool.connect();
    const queryResult = await client.query(
      'SELECT NOW() as current_time, version() as pg_version',
    );
    client.release();

    const responseTime = Date.now() - startTime;
    const metrics = poolMetrics.collectMetrics();
    const health = poolMetrics.getHealthStatus(metrics);

    console.log(
      `[${getTimestamp()}] 🏥 Health Check: ` +
        `DB=${responseTime}ms, Pool=${health.status}, ` +
        `PG=${queryResult.rows[0].pg_version.split(' ')[0]}`,
    );

    // Record successful health check timing
    poolMetrics.recordAcquisitionTime(responseTime);

    return {
      status: 'healthy',
      responseTime,
      database: 'connected',
      pool: health.status,
      postgresql_version: queryResult.rows[0].pg_version.split(' ')[0],
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[${getTimestamp()}] 🚨 Health Check Failed:`, error.message);

    if (typeof global !== 'undefined' && global.Sentry) {
      captureException(error, {
        tags: {
          component: 'database_pool',
          issue_type: 'health_check_failed',
        },
        extra: {
          responseTime: Date.now() - startTime,
          poolMetrics: poolMetrics.collectMetrics(),
        },
      });
    }

    return {
      status: 'unhealthy',
      error: error.message,
      responseTime: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}

// =============================================
// POOL MANAGEMENT
// =============================================

// 🔄 Function to create a new pool (for reconnection)
const createPool = () => {
  pool = new Pool({
    user: process.env.USER_NAME,
    host: process.env.HOST_NAME,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.PORT_NUMBER) || 5432,
    connectionTimeoutMillis: Number(process.env.CONNECTION_TIMEOUT) || 5000,
    max: Number(process.env.MAXIMUM_CLIENTS) || 10,
    idleTimeoutMillis: Number(process.env.CLIENT_EXISTENCE) || 30000,

    ssl: process.env.DB_CA
      ? {
          require: true,
          rejectUnauthorized: true,
          ca: process.env.DB_CA,
        }
      : false,
  });

  // ✅ Improved error handling following official documentation
  pool.on('error', (err, client) => {
    console.error(
      `[${getTimestamp()}] 🚨 Unexpected database pool error:`,
      err.message,
    );

    // Log pool state when error occurs
    const metrics = poolMetrics.collectMetrics();
    if (metrics) {
      console.error(
        `[${getTimestamp()}] 📊 Pool state during error: ` +
          `Total=${metrics.totalCount}, Idle=${metrics.idleCount}, Waiting=${metrics.waitingCount}`,
      );
    }

    // Send to monitoring without attempting reconnection
    if (typeof global !== 'undefined' && global.Sentry) {
      captureException(err, {
        tags: {
          component: 'database_pool',
          issue_type: 'pool_error',
        },
        extra: {
          poolMetrics: metrics,
          clientInfo: client ? 'client_provided' : 'no_client',
        },
      });
    }

    // Let the pool handle recovery naturally - don't force reconnection
  });

  // Pool event monitoring
  pool.on('connect', (client) => {
    console.log(`[${getTimestamp()}] 🔗 New client connected to pool`);
  });

  pool.on('acquire', (client) => {
    console.log(`[${getTimestamp()}] 📤 Client acquired from pool`);
  });

  pool.on('release', (err, client) => {
    if (err) {
      console.error(
        `[${getTimestamp()}] ❌ Client release error:`,
        err.message,
      );
    } else {
      console.log(`[${getTimestamp()}] 📥 Client released back to pool`);
    }
  });

  pool.on('remove', (client) => {
    console.log(`[${getTimestamp()}] 🗑️ Client removed from pool`);
  });

  return pool;
};

pool = createPool();

// =============================================
// MONITORING INTERVALS
// =============================================

/**
 * Start monitoring intervals
 */
function startMonitoring() {
  // Pool metrics logging
  metricsInterval = setInterval(() => {
    logPoolMetrics();
  }, METRICS_INTERVAL);

  // Health checks
  healthCheckInterval = setInterval(() => {
    performHealthCheck();
  }, HEALTH_CHECK_INTERVAL);

  console.log(
    `[${getTimestamp()}] 📊 Pool monitoring started (metrics: ${METRICS_INTERVAL / 1000}s, health: ${HEALTH_CHECK_INTERVAL / 1000}s)`,
  );
}

/**
 * Stop monitoring intervals
 */
function stopMonitoring() {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
  console.log(`[${getTimestamp()}] 📊 Pool monitoring stopped`);
}

// =============================================
// RECONNECTION LOGIC
// =============================================

// 🔄 Reconnection logic
const reconnectPool = async (attempt = 1) => {
  console.log(
    `[${getTimestamp()}] 🔄 Attempting to reconnect pool... (Attempt ${attempt}/${MAX_RETRIES})`,
  );

  // Stop monitoring during reconnection
  stopMonitoring();

  try {
    await pool.end(); // Close existing pool
  } catch (err) {
    console.error(
      `[${getTimestamp()}] ⚠️ Error closing existing pool:`,
      err.message,
    );
  }

  try {
    pool = createPool();
    const client = await pool.connect();
    console.log(
      `[${getTimestamp()}] ✅ Pool reconnected successfully on attempt ${attempt}`,
    );
    client.release();

    // Restart monitoring after successful reconnection
    startMonitoring();

    // Log initial metrics after reconnection
    setTimeout(() => {
      logPoolMetrics();
    }, 1000);
  } catch (err) {
    console.error(
      `[${getTimestamp()}] ❌ Pool reconnection attempt ${attempt} failed:`,
      err.message,
    );
    if (attempt < MAX_RETRIES) {
      setTimeout(() => reconnectPool(attempt + 1), RETRY_DELAY);
    } else {
      console.error(
        `[${getTimestamp()}] 🚨 Maximum reconnection attempts reached. Pool is unavailable.`,
      );

      if (typeof global !== 'undefined' && global.Sentry) {
        captureMessage('Database pool reconnection failed after max retries', {
          level: 'error',
          tags: {
            component: 'database_pool',
            issue_type: 'reconnection_failed',
          },
          extra: {
            maxRetries: MAX_RETRIES,
            lastAttempt: attempt,
          },
        });
      }
    }
  }
};

// =============================================
// CLIENT MANAGEMENT
// =============================================

// 🔹 Enhanced function to get a database client with monitoring
export const getClient = async () => {
  const acquisitionStart = Date.now();

  try {
    const client = await pool.connect();
    const acquisitionTime = Date.now() - acquisitionStart;

    // Record acquisition time for metrics
    poolMetrics.recordAcquisitionTime(acquisitionTime);

    console.log(
      `[${getTimestamp()}] ✅ Database client acquired in ${acquisitionTime}ms`,
    );

    // Log performance warning if acquisition was slow
    if (acquisitionTime > 500) {
      console.warn(
        `[${getTimestamp()}] ⚠️ Slow client acquisition: ${acquisitionTime}ms`,
      );
    }

    return client;
  } catch (err) {
    const acquisitionTime = Date.now() - acquisitionStart;

    console.error(
      `[${getTimestamp()}] ❌ Error acquiring database client after ${acquisitionTime}ms:`,
      err.message,
    );

    // Log current pool state for debugging
    const metrics = poolMetrics.collectMetrics();
    if (metrics) {
      console.error(
        `[${getTimestamp()}] 📊 Pool state during error: ` +
          `Total=${metrics.totalCount}, Idle=${metrics.idleCount}, Waiting=${metrics.waitingCount}`,
      );
    }

    if (typeof global !== 'undefined' && global.Sentry) {
      captureException(err, {
        tags: {
          component: 'database_pool',
          issue_type: 'client_acquisition_failed',
        },
        extra: {
          acquisitionTime,
          poolMetrics: metrics,
        },
      });
    }

    throw new Error('Database connection error');
  }
};

// =============================================
// INITIALIZATION & CLEANUP
// =============================================

// 🔹 Enhanced startup test with monitoring
(async () => {
  try {
    console.log(
      `[${getTimestamp()}] 🚀 Starting database pool initialization...`,
    );

    const client = await pool.connect();
    const testResult = await client.query(
      'SELECT NOW() as startup_time, version() as pg_version',
    );

    console.log(
      `[${getTimestamp()}] ✅ Initial database connection test successful`,
    );
    console.log(
      `[${getTimestamp()}] 🐘 PostgreSQL: ${testResult.rows[0].pg_version.split(' ')[0]}`,
    );
    console.log(
      `[${getTimestamp()}] ⏰ Server time: ${testResult.rows[0].startup_time}`,
    );

    client.release();

    // Start monitoring after successful initialization
    setTimeout(() => {
      startMonitoring();
      console.log(
        `[${getTimestamp()}] ✅ Database pool ready with monitoring enabled`,
      );
    }, 1000);
  } catch (err) {
    console.error(
      `[${getTimestamp()}] ❌ Initial database connection test failed. Attempting to reconnect...`,
    );
    console.error(err);
    reconnectPool();
  }
})();

// 🔹 Enhanced graceful shutdown with monitoring cleanup
const shutdown = async () => {
  console.log(
    `[${getTimestamp()}] 🛑 Initiating graceful database pool shutdown...`,
  );

  // Stop monitoring first
  stopMonitoring();

  // Log final metrics
  const finalMetrics = poolMetrics.collectMetrics();
  if (finalMetrics) {
    console.log(
      `[${getTimestamp()}] 📊 Final pool metrics: ` +
        `Total=${finalMetrics.totalCount}, Idle=${finalMetrics.idleCount}, Waiting=${finalMetrics.waitingCount}`,
    );
  }

  try {
    await pool.end();
    console.log(`[${getTimestamp()}] ✅ Database pool closed gracefully`);
  } catch (err) {
    console.error(
      `[${getTimestamp()}] ❌ Error closing database pool:`,
      err.message,
    );
  }
};

// Handle process exit signals
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
// EXPORTS & API
// =============================================

export default pool;

// Export monitoring utilities for external use
export const monitoring = {
  getMetrics: () => poolMetrics.collectMetrics(),
  getHealth: () => {
    const metrics = poolMetrics.collectMetrics();
    return metrics ? poolMetrics.getHealthStatus(metrics) : null;
  },
  performHealthCheck,
  getPoolInstance: () => pool,
};
