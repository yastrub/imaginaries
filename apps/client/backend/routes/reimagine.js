import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');
const FRONTEND_PUBLIC_DIR = path.resolve(BACKEND_DIR, '../frontend/public');
const DEFAULT_LIB = path.join(FRONTEND_PUBLIC_DIR, 'images', 'reimagine');

async function pickLibDir() {
  // Allow override via env
  const envDir = process.env.REIMAGINE_DIR;
  const candidates = [
    envDir && path.resolve(envDir),
    DEFAULT_LIB,
    path.resolve(__dirname, '../../frontend/public/images/reimagine'),
    path.resolve(process.cwd(), 'apps/client/frontend/public/images/reimagine'),
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      const st = await fs.stat(p);
      if (st && st.isDirectory()) return p;
    } catch {}
  }
  return DEFAULT_LIB; // fallback (may 404, but handled by caller)
}

function toTitle(basename) {
  const noExt = basename.replace(/\.[^.]+$/, '');
  const cleaned = noExt.replace(/[._-]+/g, ' ').trim();
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

router.get('/list', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const libDir = await pickLibDir();
    let entries = [];
    try {
      entries = await fs.readdir(libDir, { withFileTypes: true });
    } catch (e) {
      // If folder is missing or unreadable, return empty list instead of 500
      return res.json({ items: [] });
    }
    const files = entries
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((n) => /\.(png|jpg|jpeg|webp|gif)$/i.test(n));
    const items = files
      .map((name) => ({
        title: toTitle(name),
        url: `/images/reimagine/${name}`,
        filename: name,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
    return res.json({ items });
  } catch (e) {
    // As a safety net, never error for listing
    return res.json({ items: [] });
  }
});

export { router as reimagineRouter };
