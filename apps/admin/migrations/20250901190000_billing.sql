/*
  # Billing Tables (provider-agnostic)

  1. New Tables
    - billing_profiles
    - subscriptions
    - invoices

  2. Indexes
    - Appropriate indexes for fast lookups by user and provider IDs
*/

-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Billing profiles (customer-level)
CREATE TABLE IF NOT EXISTS billing_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'stripe',
  provider_customer_id text UNIQUE,
  default_payment_method text,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_billing_profiles_user_id ON billing_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_profiles_provider_customer ON billing_profiles(provider, provider_customer_id);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan text NOT NULL,
  provider text NOT NULL DEFAULT 'stripe',
  provider_subscription_id text,
  status text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_subscriptions_plan FOREIGN KEY (plan) REFERENCES plans(key)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_sub ON subscriptions(provider, provider_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'stripe',
  provider_invoice_id text,
  amount_total integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text,
  period_start timestamptz,
  period_end timestamptz,
  hosted_invoice_url text,
  invoice_pdf text,
  created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_provider_invoice ON invoices(provider, provider_invoice_id);
