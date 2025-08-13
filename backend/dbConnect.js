/**************** *********************/

// CONNECTION POOLING WITH MONITORING - SENTRY V9 - OPTIMIZED

/***************** ********************/

// dbConnect.js (version lite VPS, avec instrumentation conservée)

import pg from 'pg';
import * as dotenv from 'dotenv';
import { captureMessage, captureDatabaseError } from '../instrumentation.js';

dotenv.config();

const { Pool } = pg;

let pool;

// ✅ Variables obligatoires
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
    user: process.env.DB_USER_NAME,
    host: process.env.DB_HOST_NAME,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
    max: Number(process.env.DB_MAX_POOL) || 15, // entre 10 et 20
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
  };

  pool = new Pool(config);

  // Gestion erreurs Pool
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

    // Tentative de reconnexion après 3s
    await new Promise((res) => setTimeout(res, 3000));
    return getClient();
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
