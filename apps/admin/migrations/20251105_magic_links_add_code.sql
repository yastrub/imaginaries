ALTER TABLE magic_links ADD COLUMN IF NOT EXISTS code_hash TEXT;
CREATE INDEX IF NOT EXISTS magic_links_code_idx ON magic_links (code_hash);
