import express from 'express';
import Stripe from 'stripe';
import { auth } from '../middleware/auth.js';
import { query } from '../config/db.js';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2024-06-20' }) : null;

const router = express.Router();

function getOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

// Attempt to find or attach a user to a Stripe customer if missing in billing_profiles
async function findOrAttachUserToCustomer(customerId) {
  // Try existing mapping first
  try {
    const prof = await query(`SELECT user_id FROM billing_profiles WHERE provider = 'stripe' AND provider_customer_id = $1`, [customerId]);
    if (prof.rows?.length) return prof.rows[0].user_id;
  } catch {}
  if (!stripe) return null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    const email = (customer && customer.email) ? String(customer.email).toLowerCase() : null;
    const metaUserId = customer && customer.metadata && customer.metadata.user_id ? String(customer.metadata.user_id) : null;
    // Prefer explicit metadata mapping
    if (metaUserId) {
      try {
        await query(`INSERT INTO billing_profiles (user_id, provider, provider_customer_id) VALUES ($1,'stripe',$2) ON CONFLICT (user_id) DO UPDATE SET provider_customer_id = EXCLUDED.provider_customer_id`, [metaUserId, customerId]);
        return metaUserId;
      } catch {}
    }
    // Fallback: match by email
    if (email) {
      try {
        const u = await query(`SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`, [email]);
        if (u.rows?.length) {
          const userId = u.rows[0].id;
          await query(`INSERT INTO billing_profiles (user_id, provider, provider_customer_id) VALUES ($1,'stripe',$2) ON CONFLICT (user_id) DO UPDATE SET provider_customer_id = EXCLUDED.provider_customer_id`, [userId, customerId]);
          return userId;
        }
      } catch {}
    }
  } catch (e) {
    console.error('[billing] failed to retrieve stripe customer', e?.message || e);
  }
  return null;
}

async function getPriceIdFromDB(planKey, cycle) {
  const res = await query(`SELECT stripe_price_monthly_id, stripe_price_annual_id FROM plans WHERE key = $1`, [planKey]);
  if (!res.rows.length) return null;
  const row = res.rows[0];
  if (String(cycle).toLowerCase() === 'annual') {
    return row.stripe_price_annual_id || null;
  }
  return row.stripe_price_monthly_id || null;
}

async function mapPriceToPlan(priceId) {
  if (!priceId) return { plan: 'free', cycle: 'monthly' };
  const res = await query(
    `SELECT key as plan,
            CASE WHEN stripe_price_monthly_id = $1 THEN 'monthly'
                 WHEN stripe_price_annual_id = $1 THEN 'annual'
                 ELSE NULL END as cycle
     FROM plans
     WHERE stripe_price_monthly_id = $1 OR stripe_price_annual_id = $1
     LIMIT 1`,
    [priceId]
  );
  if (res.rows.length && res.rows[0].cycle) return { plan: res.rows[0].plan, cycle: res.rows[0].cycle };
  return { plan: 'free', cycle: 'monthly' };
}

async function ensureCustomer(user) {
  // Get or create customer and persist in billing_profiles
  const profRes = await query(
    `SELECT id, provider_customer_id FROM billing_profiles WHERE user_id = $1 AND provider = 'stripe'`,
    [user.id]
  );
  let customerId = profRes.rows?.[0]?.provider_customer_id || null;
  if (!customerId) {
    if (!stripe) throw new Error('Stripe is not configured');
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      metadata: { user_id: String(user.id) },
    });
    customerId = customer.id;
    if (profRes.rows?.length) {
      await query(`UPDATE billing_profiles SET provider_customer_id = $1 WHERE id = $2`, [customerId, profRes.rows[0].id]);
    } else {
      await query(`INSERT INTO billing_profiles (user_id, provider, provider_customer_id) VALUES ($1,'stripe',$2)`, [user.id, customerId]);
    }
  }
  return customerId;
}

// Create Stripe Checkout session
router.post('/checkout', auth, async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
    const { plan, cycle = 'monthly', success_url, cancel_url } = req.body || {};
    if (!plan || plan === 'free') return res.status(400).json({ error: 'Invalid plan' });

    const priceId = await getPriceIdFromDB(plan, cycle);
    if (!priceId) return res.status(400).json({ error: 'Price not configured for this plan/cycle' });

    const user = req.user;
    const customerId = await ensureCustomer(user);
    const origin = getOrigin(req);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: success_url || `${origin}/upgrade?status=success`,
      cancel_url: cancel_url || `${origin}/upgrade?status=cancel`,
    });

    return res.json({ url: session.url });
  } catch (e) {
    console.error('[billing] checkout error', e);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Create Stripe Billing Portal session
router.post('/portal', auth, async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
    const user = req.user;
    const customerId = await ensureCustomer(user);
    const origin = getOrigin(req);
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/upgrade`,
    });
    return res.json({ url: portal.url });
  } catch (e) {
    console.error('[billing] portal error', e);
    return res.status(500).json({ error: 'Failed to create billing portal' });
  }
});

// Webhook registration must be before express.json. This function registers raw body route.
export function registerStripeWebhook(app) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe) return res.status(500).send('Stripe not configured');
    let event;
    try {
      const sig = req.headers['stripe-signature'];
      if (webhookSecret) {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        // Unsafe fallback for dev if webhook secret is not set
        event = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body?.toString('utf-8') || '{}');
      }
    } catch (err) {
      console.error('[billing] webhook signature verification failed', err?.message);
      return res.status(400).send(`Webhook Error: ${err?.message || 'invalid signature'}`);
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const subscriptionId = session.subscription;
          const customerId = session.customer;
          if (subscriptionId && customerId) {
            await handleSubscriptionUpsert(customerId, subscriptionId);
          }
          break;
        }
        case 'customer.subscription.created': {
          const subscription = event.data.object;
          const customerId = subscription.customer;
          const subscriptionId = subscription.id;
          await handleSubscriptionUpsert(customerId, subscriptionId, subscription);
          break;
        }
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const customerId = subscription.customer;
          const subscriptionId = subscription.id;
          await handleSubscriptionUpsert(customerId, subscriptionId, subscription);
          break;
        }
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object;
          await handleInvoiceUpsert(invoice);
          break;
        }
        default:
          // ignore
          break;
      }
      return res.json({ received: true });
    } catch (err) {
      console.error('[billing] webhook handling error', err);
      return res.status(500).send('Webhook handler error');
    }
  });
}

async function handleSubscriptionUpsert(customerId, subscriptionId, subscriptionObj = null) {
  // Find or attach user by customerId
  let userId = null;
  try {
    const userRes = await query(`SELECT user_id FROM billing_profiles WHERE provider = 'stripe' AND provider_customer_id = $1`, [customerId]);
    userId = userRes.rows?.[0]?.user_id || null;
  } catch {}
  if (!userId) {
    userId = await findOrAttachUserToCustomer(customerId);
  }
  if (!userId) return; // cannot proceed without user

  let subscription = subscriptionObj;
  if (!subscription) {
    subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['plan.product', 'items'] });
  }

  const status = subscription.status;
  const toIsoOrNull = (v) => {
    if (typeof v === 'number' && Number.isFinite(v)) {
      try { return new Date(v * 1000).toISOString(); } catch { return null; }
    }
    if (typeof v === 'string' && v) {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    return null;
  };
  const current_period_start = toIsoOrNull(subscription.current_period_start);
  const current_period_end = toIsoOrNull(subscription.current_period_end);
  const cancel_at = toIsoOrNull(subscription.cancel_at);
  const canceled_at = toIsoOrNull(subscription.canceled_at);

  // Determine our internal plan key from price
  const itemPrice = subscription.items?.data?.[0]?.price || null;
  const priceId = itemPrice?.id || null;
  const unitAmount = (typeof itemPrice?.unit_amount === 'number') ? itemPrice.unit_amount : null;
  const priceCurrency = itemPrice?.currency || null;
  const interval = itemPrice?.recurring?.interval || null; // 'month' | 'year'
  const { plan, cycle } = await mapPriceToPlan(priceId);
  const isAnnual = (cycle === 'annual') || (interval === 'year');

  // Upsert into subscriptions table (UPDATE then INSERT to avoid ON CONFLICT dependency)
  try {
    const updateRes = await query(
      `UPDATE subscriptions
       SET plan = $1,
           status = $2,
           current_period_start = $3,
           current_period_end = $4,
           cancel_at = $5,
           canceled_at = $6
       WHERE provider = 'stripe' AND provider_subscription_id = $7`,
      [plan, status, current_period_start, current_period_end, cancel_at, canceled_at, subscriptionId]
    );
    if (!updateRes.rowCount) {
      await query(
        `INSERT INTO subscriptions (user_id, plan, provider, provider_subscription_id, status, current_period_start, current_period_end, cancel_at, canceled_at)
         VALUES ($1,$2,'stripe',$3,$4,$5,$6,$7,$8)`,
        [userId, plan, subscriptionId, status, current_period_start, current_period_end, cancel_at, canceled_at]
      );
    }
  } catch (e) {
    console.error('[billing] subscriptions upsert failed', e?.message || e);
  }

  // Best-effort: set price snapshot fields if columns exist
  try {
    await query(
      `UPDATE subscriptions
       SET is_annual = $1,
           original_price_cents = $2,
           currency = $3
       WHERE provider = 'stripe' AND provider_subscription_id = $4`,
      [!!isAnnual, unitAmount, priceCurrency, subscriptionId]
    );
  } catch (e) {
    if (!(e && e.code === '42703')) {
      console.error('[billing] failed to set subscription price fields', e?.message || e);
    }
  }

  // Update user's subscription_plan and stamp subscription_updated_at for auditing
  const newPlan = status === 'active' || status === 'trialing' ? plan : 'free';
  try {
    await query(
      `UPDATE users 
       SET subscription_plan = $1,
           subscription_updated_at = NOW()
       WHERE id = $2`,
      [newPlan, userId]
    );
  } catch (e) {
    console.error('[billing] failed to update user plan', e?.message || e);
  }
}

async function handleInvoiceUpsert(invoice) {
  // Find or attach user by customer via billing_profiles
  const customerId = invoice.customer;
  let userId = null;
  try {
    const userRes = await query(`SELECT user_id FROM billing_profiles WHERE provider = 'stripe' AND provider_customer_id = $1`, [customerId]);
    userId = userRes.rows?.[0]?.user_id || null;
  } catch {}
  if (!userId) {
    userId = await findOrAttachUserToCustomer(customerId);
  }
  if (!userId) return;

  // Find subscription DB id by provider_subscription_id
  let subscriptionDbId = null;
  try {
    const subRes = await query(`SELECT id FROM subscriptions WHERE provider = 'stripe' AND provider_subscription_id = $1`, [invoice.subscription]);
    subscriptionDbId = subRes.rows?.[0]?.id || null;
  } catch {}

  try {
    const amount = invoice.amount_due || invoice.amount_paid || invoice.amount_remaining || 0;
    const currency = invoice.currency || 'usd';
    const statusInv = invoice.status || null;
    const pStart = invoice.period_start || invoice.lines?.data?.[0]?.period?.start || Math.floor(Date.now()/1000);
    const pEnd = invoice.period_end || invoice.lines?.data?.[0]?.period?.end || Math.floor(Date.now()/1000);
    const hostedUrl = invoice.hosted_invoice_url || null;
    const pdfUrl = invoice.invoice_pdf || null;
    const firstLine = invoice.lines?.data?.[0] || null;
    const priceIdFromClassic = firstLine?.price?.id || null;
    const priceIdFromClover = firstLine?.pricing?.price_details?.price || null;
    const invPriceId = priceIdFromClassic || priceIdFromClover || null;

    const upd = await query(
      `UPDATE invoices
       SET user_id = $1,
           subscription_id = $2,
           amount_total = $3,
           currency = $4,
           status = $5,
           period_start = to_timestamp($6),
           period_end = to_timestamp($7),
           hosted_invoice_url = $8,
           invoice_pdf = $9
       WHERE provider = 'stripe' AND provider_invoice_id = $10`,
      [userId, subscriptionDbId, amount, currency, statusInv, pStart, pEnd, hostedUrl, pdfUrl, invoice.id]
    );
    if (!upd.rowCount) {
      await query(
        `INSERT INTO invoices (user_id, subscription_id, provider, provider_invoice_id, amount_total, currency, status, period_start, period_end, hosted_invoice_url, invoice_pdf)
         VALUES ($1,$2,'stripe',$3,$4,$5,$6, to_timestamp($7), to_timestamp($8), $9, $10)`,
        [userId, subscriptionDbId, invoice.id, amount, currency, statusInv, pStart, pEnd, hostedUrl, pdfUrl]
      );
    }
    // Backfill subscription plan from invoice price if subscriptions.plan is missing or 'free'
    try {
      if (invPriceId) {
        const { plan: mappedPlan } = await mapPriceToPlan(invPriceId);
        if (mappedPlan && mappedPlan !== 'free') {
          if (subscriptionDbId) {
            await query(
              `UPDATE subscriptions SET plan = $1 WHERE id = $2 AND (plan IS NULL OR plan = 'free')`,
              [mappedPlan, subscriptionDbId]
            );
          } else if (invoice.subscription) {
            await query(
              `UPDATE subscriptions SET plan = $1 WHERE provider = 'stripe' AND provider_subscription_id = $2 AND (plan IS NULL OR plan = 'free')`,
              [mappedPlan, invoice.subscription]
            );
          }
        }
      }
    } catch (e) {
      console.error('[billing] failed to backfill subscription plan from invoice', e?.message || e);
    }
    // Backfill subscription current period from invoice if missing
    try {
      if (subscriptionDbId) {
        await query(
          `UPDATE subscriptions
           SET current_period_start = COALESCE(current_period_start, to_timestamp($1)),
               current_period_end = COALESCE(current_period_end, to_timestamp($2))
           WHERE id = $3`,
          [pStart, pEnd, subscriptionDbId]
        );
      } else if (invoice.subscription) {
        await query(
          `UPDATE subscriptions
           SET current_period_start = COALESCE(current_period_start, to_timestamp($1)),
               current_period_end = COALESCE(current_period_end, to_timestamp($2))
           WHERE provider = 'stripe' AND provider_subscription_id = $3`,
          [pStart, pEnd, invoice.subscription]
        );
      }
    } catch (e) {
      console.error('[billing] failed to backfill subscription periods from invoice', e?.message || e);
    }
  } catch (e) {
    console.error('[billing] invoice upsert failed', e?.message || e);
  }
}

export { router as billingRouter };
