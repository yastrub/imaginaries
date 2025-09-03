import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

// Create migrations table if it doesn't exist
async function initMigrationsTable() {
  try {
    // First check if the migrations table exists
    const tableExists = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'migrations'
      );
    `);

    if (!tableExists.rows[0].exists) {
      console.log('Creating migrations table...');
      await query(`
        CREATE TABLE migrations (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Migrations table created successfully');
    }
  } catch (error) {
    console.error('Error initializing migrations table:', error);
    throw error;
  }
}

// Get list of applied migrations
async function getAppliedMigrations() {
  const result = await query('SELECT name FROM migrations ORDER BY id');
  return result.rows.map(row => row.name);
}

// Get all migration files
async function getMigrationFiles() {
  console.log(`[migrations] Using migrations directory: ${MIGRATIONS_DIR}`);
  const files = await fs.readdir(MIGRATIONS_DIR);
  return files
    .filter(f => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));
}

// Apply a single migration
async function applyMigration(filename) {
  console.log(`Applying migration: ${filename}`);
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const content = await fs.readFile(filePath, 'utf8');

  try {
    // Start transaction
    await query('BEGIN');

    // Apply migration
    await query(content);

    // Record migration
    await query(
      'INSERT INTO migrations (name) VALUES ($1)',
      [filename]
    );

    // Commit transaction
    await query('COMMIT');

    console.log(`Migration ${filename} applied successfully`);
  } catch (error) {
    // Rollback on error
    await query('ROLLBACK');
    console.error(`Error applying migration ${filename}:`, error);
    throw error;
  }
}

// Run all pending migrations
export async function runMigrations() {
  // Admin app is the single source of truth for DB migrations.
  // Disable backend migrations by default; allow override via BACKEND_RUN_MIGRATIONS=true
  const allow = ['true','1','yes','on'].includes(String(process.env.BACKEND_RUN_MIGRATIONS || '').toLowerCase());
  if (!allow) {
    console.log('Skipping backend migrations (Admin app is the source of truth). Set BACKEND_RUN_MIGRATIONS=true to override.');
    return;
  }

  try {
    // Ensure migrations table exists
    await initMigrationsTable();
    
    const applied = await getAppliedMigrations();
    const files = await getMigrationFiles();
    
    console.log('Previous migrations:', applied);
    console.log('Available migrations:', files);

    for (const file of files) {
      if (!applied.includes(file)) {
        await applyMigration(file);
      }
    }

    console.log('All migrations applied successfully');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}
