-- Add currency column to subscriptions and backfill from latest invoice if available
ALTER TABLE IF EXISTS subscriptions
  ADD COLUMN IF NOT EXISTS currency text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'currency'
  ) THEN
    UPDATE subscriptions s
    SET currency = COALESCE(s.currency, i.currency)
    FROM (
      SELECT inv.subscription_id, inv.currency
      FROM invoices inv
      JOIN (
        SELECT subscription_id, MAX(period_end) AS max_end
        FROM invoices
        WHERE subscription_id IS NOT NULL
        GROUP BY subscription_id
      ) x ON x.subscription_id = inv.subscription_id AND x.max_end = inv.period_end
    ) i
    WHERE s.id = i.subscription_id AND s.currency IS NULL;
  END IF;
END $$;
