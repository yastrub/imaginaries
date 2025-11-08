import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { query } from '../config/db.js';
import { uploadUrlToCloudinary } from '../config/cloudinary.js';
import { sendEmail } from '../config/email.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVER_DIR = path.resolve(__dirname, '..');
const DEV_DATA_DIR = path.join(SERVER_DIR, 'dev-data');
const ORDERS_FILE = path.join(DEV_DATA_DIR, 'merch_orders.json');

async function ensureOrdersFile() {
  try { await fs.mkdir(DEV_DATA_DIR, { recursive: true }); } catch {}
  try {
    await fs.access(ORDERS_FILE);
  } catch {
    await fs.writeFile(ORDERS_FILE, JSON.stringify({ orders: [] }, null, 2));
  }
}

async function readOrders() {
  await ensureOrdersFile();
  const txt = await fs.readFile(ORDERS_FILE, 'utf8');
  try { return JSON.parse(txt); } catch { return { orders: [] }; }
}

async function writeOrders(data) {
  await ensureOrdersFile();
  await fs.writeFile(ORDERS_FILE, JSON.stringify(data, null, 2));
}

// Create draft order
router.post('/orders/draft', async (req, res) => {
  try {
    const {
      sourceImageUrl,
      merchType = 'T-SHIRT',
      details = {}, // { size, color }
      price = { amount: 160, currency: 'AED' }
    } = req.body || {};

    if (!sourceImageUrl) return res.status(400).json({ error: 'Missing sourceImageUrl' });

    // First, copy source image into dedicated Cloudinary folder for orders
    let orderImageUrl = null;
    try {
      const ts = Date.now();
      orderImageUrl = await uploadUrlToCloudinary('merch/orders', `order-${ts}`, sourceImageUrl);
    } catch (e) {
      console.warn('[MerchOrders] Failed to copy image to merch/orders, using source', e?.message);
      orderImageUrl = sourceImageUrl;
    }

    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();

    // Try DB first
    try {
      const size = (details?.size || '').toString().toUpperCase() || null;
      const color = (details?.color || '').toString().toLowerCase() || null;
      const amount = Number(price?.amount ?? 160);
      const currency = (price?.currency || 'AED').toString().toUpperCase();
      await query(
        `INSERT INTO merch_orders (id, status, merch_type, color, size, price_amount, price_currency, source_image_url, order_image_url, created_at, updated_at)
         VALUES ($1, 'draft', $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [id, merchType, color, size, amount, currency, sourceImageUrl, orderImageUrl]
      );
      const order = {
        id,
        status: 'draft',
        merch_type: merchType,
        source_image: sourceImageUrl,
        order_image: orderImageUrl,
        merch_details: { size, color },
        merch_price: { amount, currency },
        order_details: null,
        created_at,
        updated_at: created_at
      };
      return res.json({ id, order, url: `/merch/order/${id}` });
    } catch (dbErr) {
      console.warn('[MerchOrders] DB unavailable, using dev JSON store:', dbErr?.message);
      const orders = await readOrders();
      const order = {
        id,
        status: 'draft',
        merch_type: merchType,
        source_image: sourceImageUrl,
        order_image: orderImageUrl,
        merch_details: details,
        merch_price: price,
        order_details: null,
        created_at,
        updated_at: created_at
      };
      orders.orders.push(order);
      await writeOrders(orders);
      return res.json({ id, order, url: `/merch/order/${id}` });
    }
  } catch (e) {
    console.error('[MerchOrders] draft error', e);
    return res.status(500).json({ error: 'Failed to create draft order' });
  }
});

// Get order by id
router.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    try {
      const r = await query('SELECT * FROM merch_orders WHERE id = $1 LIMIT 1', [id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      const row = r.rows[0];
      const order = {
        id: row.id,
        status: row.status,
        merch_type: row.merch_type,
        source_image: row.source_image_url,
        order_image: row.order_image_url,
        merch_details: { size: row.size, color: row.color },
        merch_price: { amount: Number(row.price_amount), currency: row.price_currency },
        order_details: row.name || row.phone || row.email || row.notes ? { name: row.name, phone: row.phone, email: row.email, comments: row.notes } : null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
      return res.json({ order });
    } catch (dbErr) {
      // Fallback JSON store
      const orders = await readOrders();
      const order = orders.orders.find(o => o.id === id);
      if (!order) return res.status(404).json({ error: 'Not found' });
      return res.json({ order });
    }
  } catch (e) {
    console.error('[MerchOrders] get error', e);
    return res.status(500).json({ error: 'Failed to get order' });
  }
});

// Submit order details (finalize)
router.post('/orders/:id/submit', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, comments } = req.body || {};
    if (!name || !phone || !email) return res.status(400).json({ error: 'Missing required fields' });
    const now = new Date().toISOString();
    try {
      // Update DB
      const r = await query('UPDATE merch_orders SET name=$1, phone=$2, email=$3, notes=$4, status=$5, updated_at=NOW() WHERE id=$6 RETURNING *', [name, phone, email, comments || '', 'submitted', id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
      const row = r.rows[0];
      // Email admin
      try {
        await sendEmail('orderCreated', {
          email, // reply-to
          name,
          imageUrl: row.order_image_url || row.source_image_url,
          imageId: row.id,
          createdAt: new Date().toISOString(),
          estimatedCost: undefined,
          selectedOption: `${row.merch_type || 'T-SHIRT'} ${row.size || ''} ${row.color || ''}`.trim(),
          selectedPrice: (row.price_amount != null) ? `${Number(row.price_amount)} ${row.price_currency || 'AED'}` : undefined,
          notes: comments || undefined,
          phone,
        });
      } catch (emErr) {
        console.warn('[MerchOrders] email send failed:', emErr?.message);
      }
      const order = {
        id: row.id,
        status: row.status,
        merch_type: row.merch_type,
        source_image: row.source_image_url,
        order_image: row.order_image_url,
        merch_details: { size: row.size, color: row.color },
        merch_price: { amount: Number(row.price_amount), currency: row.price_currency },
        order_details: { name: row.name, phone: row.phone, email: row.email, comments: row.notes },
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
      return res.json({ ok: true, order });
    } catch (dbErr) {
      // Fallback JSON store
      const orders = await readOrders();
      const idx = orders.orders.findIndex(o => o.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });
      orders.orders[idx].order_details = { name, phone, email, comments: comments || '' };
      orders.orders[idx].status = 'submitted';
      orders.orders[idx].updated_at = now;
      await writeOrders(orders);
      return res.json({ ok: true, order: orders.orders[idx] });
    }
  } catch (e) {
    console.error('[MerchOrders] submit error', e);
    return res.status(500).json({ error: 'Failed to submit order' });
  }
});

export { router as merchOrdersRouter };
