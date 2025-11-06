import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env from multiple likely locations
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1) Default CWD
dotenv.config();
// 2) apps/client/backend/.env
if (!process.env.CLOUDINARY_CLOUD_NAME) {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
}
// 3) Monorepo root .env
if (!process.env.CLOUDINARY_CLOUD_NAME) {
  dotenv.config({ path: path.resolve(__dirname, '../../../..', '.env') });
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const FOLDER_BASE = 'artificial/events/01';
const PREFIXES_TO_DELETE = [
  `${FOLDER_BASE}/inputs`,
  `${FOLDER_BASE}/assets`
];

async function listByPrefix(prefix) {
  const res = await cloudinary.api.resources({
    type: 'upload',
    prefix,
    max_results: 500
  });
  return res.resources || [];
}

async function run() {
  const args = process.argv.slice(2);
  const doDelete = args.includes('--delete');
  const dryRun = args.includes('--dry-run') || (!doDelete);

  console.log(`[MerchCleanup] Base folder: ${FOLDER_BASE}`);
  console.log(`[MerchCleanup] Prefixes to target: ${PREFIXES_TO_DELETE.join(', ')}`);
  console.log(`[MerchCleanup] Mode: ${doDelete ? 'DELETE' : 'LIST (dry-run)'}`);

  let total = 0;
  for (const prefix of PREFIXES_TO_DELETE) {
    const items = await listByPrefix(prefix);
    total += items.length;
    console.log(`\n[Prefix] ${prefix} -> ${items.length} resources`);
    for (const r of items) {
      console.log(JSON.stringify({ public_id: r.public_id, url: r.secure_url, created_at: r.created_at }));
    }

    if (doDelete && items.length) {
      console.log(`[Delete] Deleting resources under: ${prefix}`);
      const delRes = await cloudinary.api.delete_resources_by_prefix(prefix);
      const deletedCount = delRes.deleted ? Object.keys(delRes.deleted).length : 0;
      console.log(`[Delete] Deleted: ${deletedCount}`);
    }
  }

  if (!doDelete) {
    console.log(`\n[Summary] Found ${total} resources (dry-run). To delete, re-run with --delete`);
  } else {
    console.log(`\n[Summary] Delete completed.`);
  }
}

run().catch((err) => {
  console.error('[MerchCleanup] Error:', err);
  process.exit(1);
});
