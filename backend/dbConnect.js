/**************** *********************/

// CONNECTION POOLING WITH MONITORING - SENTRY V9 - OPTIMIZED

/***************** ********************/

// dbConnect.js (version lite étape 1 avec initializeBenewConfig)

import pg from 'pg';
import { captureMessage, captureDatabaseError } from '../instrumentation.js';
import { initializeBenewConfig } from '@/utils/doppler';
const { Pool } = pg;

let pool;
let dopplerConfig = {};

// ✅ Variables essentielles
const requiredEnvVars = [
  'DB_USER_NAME',
  'DB_HOST_NAME',
  'DB_NAME',
  'DB_PASSWORD',
  'DB_PORT',
];

requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    captureMessage(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

export function createPool() {
  if (pool) return pool;

  const config = {
    user: process.env.DB_USER_NAME || dopplerConfig.DB_USER_NAME,
    host: process.env.DB_HOST_NAME || dopplerConfig.DB_HOST_NAME,
    database: process.env.DB_NAME || dopplerConfig.DB_NAME,
    password: process.env.DB_PASSWORD || dopplerConfig.DB_PASSWORD,
    port: Number(process.env.DB_PORT || dopplerConfig.DB_PORT) || 5432,
    max: Number(process.env.DB_MAX_POOL || dopplerConfig.DB_MAX_POOL) || 15, // 10–20
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  };

  pool = new Pool(config);

  // Gestion erreur critique du pool
  pool.on('error', (err) => {
    captureDatabaseError(err);
  });

  return pool;
}

export async function getClient() {
  try {
    const client = await createPool().connect();
    return client;
  } catch (err) {
    captureDatabaseError(err);
    await new Promise((res) => setTimeout(res, 3000));
    return getClient(); // Reconnexion
  }
}

export async function reconnectPool() {
  if (pool) {
    await closePool();
  }
  createPool();
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Test simple au démarrage avec config Doppler
(async () => {
  try {
    dopplerConfig = await initializeBenewConfig();

    const client = await getClient();
    await client.query('SELECT NOW()');
    client.release();

    captureMessage('Database connection established successfully.');
  } catch (err) {
    captureDatabaseError(err);
  }
})();
