-- Partners & Terminals (UUID IDs)
-- Run against the same Postgres used by ADMIN_DATABASE_URL/DATABASE_URL

-- partners
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partners_company_name ON partners (company_name);

-- terminals
CREATE TABLE IF NOT EXISTS terminals (
  id UUID PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  mac_address TEXT UNIQUE,
  last_seen_ip INET,
  last_seen_at TIMESTAMPTZ,
  app_version TEXT,
  os_version TEXT,
  location_text TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_terminals_partner_id ON terminals (partner_id);
CREATE INDEX IF NOT EXISTS idx_terminals_last_seen_at ON terminals (last_seen_at);

-- updated_at triggers (optional)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_partners'
  ) THEN
    CREATE OR REPLACE FUNCTION trigger_set_timestamp() RETURNS trigger AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$ LANGUAGE plpgsql;

    CREATE TRIGGER set_timestamp_partners
    BEFORE UPDATE ON partners
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_timestamp_terminals'
  ) THEN
    CREATE TRIGGER set_timestamp_terminals
    BEFORE UPDATE ON terminals
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();
  END IF;
END $$;
