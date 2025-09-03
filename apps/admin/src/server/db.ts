import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('Missing ADMIN_DATABASE_URL or DATABASE_URL for Admin API');
    }
    pool = new Pool({ connectionString, ssl: process.env.ADMIN_DATABASE_USE_SSL === 'true' ? { rejectUnauthorized: false } : undefined });
  }
  return pool;
}

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
  const p = getPool();
  const res = await p.query(text, params);
  return { rows: res.rows as T[] };
}

export async function closeDB() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function withTransaction<R>(fn: (tx: (text: string, params?: any[]) => Promise<{ rows: any[] }>) => Promise<R>): Promise<R> {
  const p = getPool();
  const client: PoolClient = await p.connect();
  try {
    await client.query('BEGIN');
    const tx = async (text: string, params?: any[]) => {
      const res = await client.query(text, params);
      return { rows: res.rows };
    };
    const result = await fn(tx);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
}
