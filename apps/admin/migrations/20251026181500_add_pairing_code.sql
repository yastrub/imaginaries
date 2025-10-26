-- Add pairing_code to terminals for pairing flow
ALTER TABLE terminals
  ADD COLUMN IF NOT EXISTS pairing_code TEXT;

-- Unique index on pairing_code when not null
CREATE UNIQUE INDEX IF NOT EXISTS ux_terminals_pairing_code
  ON terminals (pairing_code)
  WHERE pairing_code IS NOT NULL;
