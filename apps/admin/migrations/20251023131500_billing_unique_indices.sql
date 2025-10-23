-- Ensure uniqueness for provider IDs used in upserts
ALTER TABLE IF EXISTS subscriptions
  ADD CONSTRAINT subscriptions_provider_subscription_id_unique UNIQUE (provider_subscription_id);

ALTER TABLE IF EXISTS invoices
  ADD CONSTRAINT invoices_provider_invoice_id_unique UNIQUE (provider_invoice_id);
