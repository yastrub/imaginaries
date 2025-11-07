#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const LIB_DIR = path.join(PUBLIC_DIR, 'images', 'reimagine');
const MANIFEST_PATH = path.join(LIB_DIR, 'manifest.json');

function toTitle(basename) {
  const noExt = basename.replace(/\.[^.]+$/, '');
  const cleaned = noExt.replace(/[._-]+/g, ' ').trim();
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

async function main() {
  try {
    const entries = await fs.readdir(LIB_DIR, { withFileTypes: true });
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

    const json = { items };
    await fs.writeFile(MANIFEST_PATH, JSON.stringify(json, null, 2));
    console.log(`[reimagine] Manifest written: ${MANIFEST_PATH} (${items.length} items)`);
  } catch (e) {
    console.error('[reimagine] Failed to generate manifest:', e);
    process.exitCode = 1;
  }
}

main();
