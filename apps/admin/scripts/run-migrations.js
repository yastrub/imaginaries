// Run SQL migrations from ./migrations on Admin start
// Usage: node scripts/run-migrations.js
// Respects ADMIN_RUN_MIGRATIONS=false to skip

import { readdir, readFile, mkdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureDir(dir) {
  try {
    await mkdir(dir, { recursive: true });
  } catch {}
}

async function loadEnvFiles() {
  // Minimal .env loader for Admin scripts. Precedence: .env -> .env.local (override)
  const base = path.join(__dirname, '..');
  const parse = (src) => {
    const out = {};
    for (const line of src.split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1);
      // strip surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
    return out;
  };
  const apply = (envMap, { override } = { override: false }) => {
    for (const [k, v] of Object.entries(envMap)) {
      if (override || process.env[k] === undefined) process.env[k] = v;
    }
  };
  try {
    const env = await readFile(path.join(base, '.env'), 'utf8');
    apply(parse(env), { override: false });
  } catch {}
  try {
    const envLocal = await readFile(path.join(base, '.env.local'), 'utf8');
    apply(parse(envLocal), { override: true });
  } catch {}
  // Optional: load env.development and env.development.local with override=true
  try {
    const envDev = await readFile(path.join(base, '.env.development'), 'utf8');
    apply(parse(envDev), { override: true });
  } catch {}
  try {
    const envDevLocal = await readFile(path.join(base, '.env.development.local'), 'utf8');
    apply(parse(envDevLocal), { override: true });
  } catch {}
}

// Ensure a single canonical registry: public.migrations
// If a legacy table named "schema_migrations" exists, unify it into "migrations".
async function ensureMigrationsRegistry(client) {
  // Detect presence of current/legacy tables
  const [{ rows: migRows }, { rows: smRows }] = await Promise.all([
    client.query("SELECT to_regclass('public.migrations') AS reg"),
    client.query("SELECT to_regclass('public.schema_migrations') AS reg"),
  ]);
  const hasMigrations = migRows[0]?.reg !== null;
  const hasSchema = smRows[0]?.reg !== null;

  if (!hasMigrations && hasSchema) {
    console.log('[migrations] Renaming legacy "schema_migrations" to "migrations"');
    await client.query('ALTER TABLE public.schema_migrations RENAME TO migrations');
  }

  // Create canonical registry if missing
  await client.query(`CREATE TABLE IF NOT EXISTS public.migrations (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  // If both tables exist (rare), backfill missing entries from legacy into canonical
  if (hasMigrations && hasSchema) {
    console.log('[migrations] Backfilling from legacy registry (schema_migrations) if needed');
    try {
      await client.query(`
        INSERT INTO public.migrations(name, applied_at)
        SELECT s.name, COALESCE(s.applied_at, now())
        FROM public.schema_migrations s
        ON CONFLICT (name) DO NOTHING
      `);
    } catch {
      // Best-effort: ignore if legacy table schema is incompatible
    }
  }
}

async function run() {
  // Ensure Admin .env files are loaded before reading process.env
  await loadEnvFiles();
  if (process.env.ADMIN_RUN_MIGRATIONS === 'false') {
    console.log('[migrations] Skipped (ADMIN_RUN_MIGRATIONS=false)');
    return;
  }

  const connectionString = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn('[migrations] No ADMIN_DATABASE_URL or DATABASE_URL set. Skipping migrations.');
    return;
  }

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  console.log(`[migrations] Using migrations directory: ${migrationsDir}`);
  await ensureDir(migrationsDir);

  const pool = new Pool({ connectionString, ssl: process.env.ADMIN_DATABASE_USE_SSL === 'true' ? { rejectUnauthorized: false } : undefined });
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [728391]);
    await ensureMigrationsRegistry(client);
    try {
      const { rows } = await client.query('SELECT COUNT(*)::int AS c FROM public.migrations');
      console.log(`[migrations] Registry entries: ${rows[0]?.c ?? 0}`);
    } catch {}

    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    if (files.length === 0) {
      console.log('[migrations] No .sql files found. Nothing to do.');
      return;
    }

    console.log(`[migrations] Found ${files.length} files. Checking for pending migrations...`);

    let applied = 0;
    for (const file of files) {
      const name = file;
      const { rowCount } = await client.query('SELECT 1 FROM public.migrations WHERE name = $1', [name]);
      if (rowCount) {
        continue; // already applied
      }
      const full = path.join(migrationsDir, file);
      const sql = await readFile(full, 'utf8');
      console.log(`[migrations] Applying: ${name}`);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO public.migrations(name) VALUES ($1)', [name]);
        await client.query('COMMIT');
        applied += 1;
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`[migrations] Failed: ${name}`);
        throw e;
      }
    }

    console.log(`[migrations] Done. Applied ${applied} migration(s).`);
  } finally {
    try { await client.query('SELECT pg_advisory_unlock($1)', [728391]); } catch {}
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error('[migrations] Error:', e);
  process.exitCode = 1;
});
