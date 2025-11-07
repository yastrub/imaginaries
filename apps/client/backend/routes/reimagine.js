import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_DIR = path.resolve(__dirname, '..');
const FRONTEND_PUBLIC_DIR = path.resolve(BACKEND_DIR, '../frontend/public');
const LIB_DIR = path.join(FRONTEND_PUBLIC_DIR, 'images', 'reimagine');

function toTitle(basename) {
  const noExt = basename.replace(/\.[^.]+$/, '');
  const cleaned = noExt.replace(/[._-]+/g, ' ').trim();
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

router.get('/list', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    let entries = [];
    try {
      entries = await fs.readdir(LIB_DIR, { withFileTypes: true });
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
