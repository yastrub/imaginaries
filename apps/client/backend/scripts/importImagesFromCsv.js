import fs from 'fs';
import path from 'path';
import readline from 'readline';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

// Load env from server/.env explicitly
dotenv.config({ path: path.join(path.dirname(new URL(import.meta.url).pathname), '..', '.env') });

// Resolve CSV path relative to repo root
const repoRoot = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const CSV_PATH = process.env.IMAGES_CSV_PATH || path.join(repoRoot, 'data', 'images_rows.csv');

function getSslOption() {
  const sslRaw = (process.env.DATABASE_USE_SSL ?? process.env.DATABASE_SSL ?? '').toString().toLowerCase();
  if (sslRaw === 'true' || sslRaw === 'require') return { rejectUnauthorized: false };
  if (sslRaw === 'false' || sslRaw === 'disable') return undefined;
  return process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined;
}

function parseCsvLine(line) {
  const result = [];
  let i = 0, cur = '', inQuotes = false;
  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { // escaped quote
          cur += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false; i++; continue;
        }
      } else {
        cur += ch; i++; continue;
      }
    } else {
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { result.push(cur); cur = ''; i++; continue; }
      cur += ch; i++; continue;
    }
  }
  result.push(cur);
  return result;
}

function toBool(v) { return String(v).trim().toLowerCase() === 'true'; }

function parseMetadata(cell) {
  if (!cell || !cell.trim()) return {};
  // Try parse directly
  try { return JSON.parse(cell); } catch {}
  // Try to unquote if wrapped as string
  const trimmed = cell.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('\'') && trimmed.endsWith('\''))) {
    const inner = trimmed.slice(1, -1);
    try { return JSON.parse(inner); } catch {}
  }
  // Last resort: replace doubled quotes
  try { return JSON.parse(trimmed.replace(/""/g, '"')); } catch {}
  return {};
}

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  if (!fs.existsSync(CSV_PATH)) {
    console.error('CSV not found:', CSV_PATH);
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL, ...(getSslOption() ? { ssl: getSslOption() } : {}) });
  const client = await pool.connect();
  console.log('Connected to DB. Importing from', CSV_PATH);

  const rl = readline.createInterface({ input: fs.createReadStream(CSV_PATH) });
  let header = null; let inserted = 0; let duplicated = 0; let skipped = 0; let failed = 0; let lineNo = 0;
  let buffer = '';

  try {
    for await (const rawLine of rl) {
      const line = rawLine.replace(/\r$/, '');
      lineNo++;
      if (lineNo === 1) { header = parseCsvLine(line).map(h => h.trim()); continue; }
      if (!line.trim() && !buffer) continue;
      buffer = buffer ? buffer + '\n' + line : line;
      let cells = parseCsvLine(buffer);
      if (cells.length < header.length) {
        // likely a multiline record; continue accumulating
        continue;
      }
      // We have a full record; clear buffer
      const recordStr = buffer; buffer = '';
      const row = Object.fromEntries(header.map((k, idx) => [k, cells[idx] ?? '']));

      try {
        const id = row.id?.trim();
        const user_id = row.user_id?.trim();
        const prompt = row.prompt ?? '';
        const image_url = row.image_url?.trim() || null;
        const watermarked_url = row.watermarked_url?.trim() || null;
        const metadata = parseMetadata(row.metadata || '');
        const is_private = toBool(row.is_private || 'false');
        const created_at = row.created_at?.trim() || new Date().toISOString();
        const estimated_cost = row.estimated_cost?.trim() || null;

        if (!id || !user_id || !image_url) {
          skipped++;
          if (skipped <= 5) {
            console.warn('Skip reason (missing field) at line', lineNo, { id, user_id, image_url });
          }
          continue;
        }

        const upsertMode = (process.env.UPSERT_MODE || '').toLowerCase();
        const doUpdate = upsertMode === 'update';
        const q = doUpdate
          ? `INSERT INTO images (id, user_id, prompt, image_url, watermarked_url, metadata, is_private, created_at, estimated_cost)
             VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
             ON CONFLICT (id) DO UPDATE SET
               user_id=EXCLUDED.user_id,
               prompt=EXCLUDED.prompt,
               image_url=EXCLUDED.image_url,
               watermarked_url=EXCLUDED.watermarked_url,
               metadata=EXCLUDED.metadata,
               is_private=EXCLUDED.is_private,
               created_at=EXCLUDED.created_at,
               estimated_cost=EXCLUDED.estimated_cost`
          : `INSERT INTO images (id, user_id, prompt, image_url, watermarked_url, metadata, is_private, created_at, estimated_cost)
             VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)
             ON CONFLICT (id) DO NOTHING`;
        const res = await client.query(
          q,
          [id, user_id, prompt, image_url, watermarked_url, JSON.stringify(metadata), is_private, created_at, estimated_cost]
        );
        if (res.rowCount && res.rowCount > 0) inserted++; else duplicated++;
      } catch (e) {
        failed++;
        console.error(`Line ${lineNo} failed:`, e.message);
      }
    }
  } catch (e) {
    throw e;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(`Import finished. Inserted: ${inserted}, Duplicates: ${duplicated}, Skipped: ${skipped}, Failed: ${failed}`);
}

main().catch(err => { console.error('Import error:', err); process.exit(1); });
