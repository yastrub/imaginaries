import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

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

    const orders = await readOrders();
    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();

    const order = {
      id,
      status: 'draft',
      merch_type: merchType,
      source_image: sourceImageUrl,
      merch_details: details,
      merch_price: price,
      order_details: null,
      created_at,
      updated_at: created_at
    };

    orders.orders.push(order);
    await writeOrders(orders);

    const urlPath = `/merch/order/${id}`;
    return res.json({ id, order, url: urlPath });
  } catch (e) {
    console.error('[MerchOrders] draft error', e);
    return res.status(500).json({ error: 'Failed to create draft order' });
  }
});

// Get order by id
router.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const orders = await readOrders();
    const order = orders.orders.find(o => o.id === id);
    if (!order) return res.status(404).json({ error: 'Not found' });
    return res.json({ order });
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

    const orders = await readOrders();
    const idx = orders.orders.findIndex(o => o.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const now = new Date().toISOString();
    orders.orders[idx].order_details = { name, phone, email, comments: comments || '' };
    orders.orders[idx].status = 'submitted';
    orders.orders[idx].updated_at = now;

    await writeOrders(orders);
    return res.json({ ok: true, order: orders.orders[idx] });
  } catch (e) {
    console.error('[MerchOrders] submit error', e);
    return res.status(500).json({ error: 'Failed to submit order' });
  }
});

export { router as merchOrdersRouter };
