-- Simple pricing extensions: annual price on plans; discount on promo codes; pricing snapshot on subscriptions
-- Safe to run multiple times due to IF NOT EXISTS guards where possible.

-- Plans: add annual_price_cents
ALTER TABLE IF EXISTS plans
  ADD COLUMN IF NOT EXISTS annual_price_cents integer NOT NULL DEFAULT 0;

-- Promo codes: add discount as fraction (0-1)
ALTER TABLE IF EXISTS promo_codes
  ADD COLUMN IF NOT EXISTS discount numeric(4,3) NOT NULL DEFAULT 0;

-- If legacy discount_cents exists, migrate values into discount and drop the old column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'promo_codes' AND column_name = 'discount_cents'
  ) THEN
    UPDATE promo_codes SET discount = COALESCE(discount, 0) 
    WHERE discount = 0 AND promo_codes.discount_cents IS NOT NULL AND promo_codes.discount_cents > 0;
    -- convert cents to fraction (divide by 100)
    UPDATE promo_codes SET discount = LEAST(1, GREATEST(0, (promo_codes.discount_cents::numeric / 100.0)))
    WHERE promo_codes.discount_cents IS NOT NULL;
    ALTER TABLE promo_codes DROP COLUMN IF EXISTS discount_cents;
  END IF;
END $$;

-- Subscriptions: add is_annual (immutable), original price, promo code applied, and discount (fraction)
ALTER TABLE IF EXISTS subscriptions
  ADD COLUMN IF NOT EXISTS is_annual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_price_cents integer,
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS discount numeric(4,3) NOT NULL DEFAULT 0;

-- If legacy discount_cents exists on subscriptions, migrate and drop
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'discount_cents'
  ) THEN
    UPDATE subscriptions SET discount = COALESCE(discount, 0)
    WHERE discount = 0 AND subscriptions.discount_cents IS NOT NULL AND subscriptions.discount_cents > 0;
    UPDATE subscriptions SET discount = LEAST(1, GREATEST(0, (subscriptions.discount_cents::numeric / 100.0)))
    WHERE subscriptions.discount_cents IS NOT NULL;
    ALTER TABLE subscriptions DROP COLUMN IF EXISTS discount_cents;
  END IF;
END $$;

-- Enforce immutability of is_annual after insert (cannot change once set)
-- Define or update the trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.prevent_is_annual_change() RETURNS trigger AS $fn$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_annual IS DISTINCT FROM OLD.is_annual THEN
    RAISE EXCEPTION 'subscriptions.is_annual is immutable and cannot be changed';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subscriptions_is_annual_immutable'
  ) THEN
    CREATE TRIGGER trg_subscriptions_is_annual_immutable
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.prevent_is_annual_change();
  END IF;
END$$;
