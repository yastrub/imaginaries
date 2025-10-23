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
  // Find user by customerId
  const userRes = await query(`SELECT user_id FROM billing_profiles WHERE provider = 'stripe' AND provider_customer_id = $1`, [customerId]);
  if (!userRes.rows.length) return;
  const userId = userRes.rows[0].user_id;

  let subscription = subscriptionObj;
  if (!subscription) {
    subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['plan.product', 'items'] });
  }

  const status = subscription.status;
  const current_period_start = new Date(subscription.current_period_start * 1000).toISOString();
  const current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
  const cancel_at = subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null;
  const canceled_at = subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null;

  // Determine our internal plan key from price
  const priceId = subscription.items?.data?.[0]?.price?.id || null;
  const { plan } = await mapPriceToPlan(priceId);

  // Upsert into subscriptions table
  await query(
    `INSERT INTO subscriptions (user_id, plan, provider, provider_subscription_id, status, current_period_start, current_period_end, cancel_at, canceled_at)
     VALUES ($1,$2,'stripe',$3,$4,$5,$6,$7,$8)
     ON CONFLICT (provider_subscription_id)
     DO UPDATE SET plan = EXCLUDED.plan, status = EXCLUDED.status, current_period_start = EXCLUDED.current_period_start, current_period_end = EXCLUDED.current_period_end, cancel_at = EXCLUDED.cancel_at, canceled_at = EXCLUDED.canceled_at, updated_at = NOW()`,
    [userId, plan, subscriptionId, status, current_period_start, current_period_end, cancel_at, canceled_at]
  );

  // Update user's subscription_plan
  const newPlan = status === 'active' || status === 'trialing' ? plan : 'free';
  await query(`UPDATE users SET subscription_plan = $1 WHERE id = $2`, [newPlan, userId]);
}

async function handleInvoiceUpsert(invoice) {
  // Find the user by customer via billing_profiles
  const customerId = invoice.customer;
  const userRes = await query(`SELECT user_id FROM billing_profiles WHERE provider = 'stripe' AND provider_customer_id = $1`, [customerId]);
  if (!userRes.rows.length) return;
  const userId = userRes.rows[0].user_id;

  // Find subscription DB id by provider_subscription_id
  let subscriptionDbId = null;
  try {
    const subRes = await query(`SELECT id FROM subscriptions WHERE provider = 'stripe' AND provider_subscription_id = $1`, [invoice.subscription]);
    subscriptionDbId = subRes.rows?.[0]?.id || null;
  } catch {}

  await query(
    `INSERT INTO invoices (user_id, subscription_id, provider, provider_invoice_id, amount_total, currency, status, period_start, period_end, hosted_invoice_url, invoice_pdf)
     VALUES ($1,$2,'stripe',$3,$4,$5,$6, to_timestamp($7), to_timestamp($8), $9, $10)
     ON CONFLICT (provider_invoice_id)
     DO UPDATE SET amount_total = EXCLUDED.amount_total, currency = EXCLUDED.currency, status = EXCLUDED.status, period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end, hosted_invoice_url = EXCLUDED.hosted_invoice_url, invoice_pdf = EXCLUDED.invoice_pdf, updated_at = NOW()`,
    [userId, subscriptionDbId, invoice.id, invoice.amount_due || invoice.amount_paid || invoice.amount_remaining || 0, invoice.currency || 'usd', invoice.status || null, invoice.period_start || invoice.lines?.data?.[0]?.period?.start || Math.floor(Date.now()/1000), invoice.period_end || invoice.lines?.data?.[0]?.period?.end || Math.floor(Date.now()/1000), invoice.hosted_invoice_url || null, invoice.invoice_pdf || null]
  );
}

export { router as billingRouter };
