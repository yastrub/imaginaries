import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import * as devDB from './dev.js';

dotenv.config();

// Allow forcing Postgres usage in development via env flag
const forcePostgresInDev = ['true', '1', 'yes', 'on'].includes(String(process.env.DEV_USE_POSTGRES || '').toLowerCase());
const useJsonDev = process.env.NODE_ENV === 'development' && !forcePostgresInDev;

let pool;
if (!useJsonDev) {
  // Prefer new flag DATABASE_USE_SSL; fall back to legacy DATABASE_SSL
  const sslRaw = (process.env.DATABASE_USE_SSL ?? process.env.DATABASE_SSL ?? '').toString();
  const sslEnv = sslRaw.toLowerCase();
  const sslOption = (
    sslEnv === 'true' || sslEnv === 'require'
  ) ? { rejectUnauthorized: false }
    : (sslEnv === 'false' || sslEnv === 'disable') ? undefined
    : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined);

  const poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ...(sslOption ? { ssl: sslOption } : {})
  };

  pool = new Pool(poolConfig);
}

export async function query(text, params) {
  if (useJsonDev) {
    return devDB.query(text, params);
  }

  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

export async function connectDB() {
  try {
    if (useJsonDev) {
      await devDB.initDevEnvironment();
      console.log('Connected to development JSON database');
      return;
    }

    const client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    client.release();
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
}

export async function closeDB() {
  if (!useJsonDev && pool) {
    try {
      await pool.end();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing database connection:', error);
      throw error;
    }
  }
}
