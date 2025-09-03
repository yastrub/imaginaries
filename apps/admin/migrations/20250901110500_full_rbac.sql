/*
  # Full RBAC schema (single-role model)

  Creates roles table (with permissions text[] array), seeds fixed roles (1=superuser, 2=public),
  adds users.role_id, and enforces NOT NULL/default.
  Removes legacy user_roles many-to-many if present. If migrating from an older version
  that had role_permissions, it will be backfilled into roles.permissions and dropped.
*/

-- 1) Roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2) Permissions are stored directly on roles as a text[] array of permission strings
-- Ensure the column exists and is non-null with a default of {}
ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS permissions text[] NOT NULL DEFAULT '{}'::text[];

-- If migrating from an older schema that used role_permissions, backfill and drop it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'role_permissions'
  ) THEN
    UPDATE roles r
    SET permissions = COALESCE(
      (
        SELECT COALESCE(array_agg(DISTINCT rp.permission ORDER BY rp.permission), '{}'::text[])
        FROM role_permissions rp
        WHERE rp.role_id = r.id
      ),
      '{}'::text[]
    );
    DROP TABLE role_permissions;
  END IF;
END $$;

-- Index for fast membership queries on permissions
CREATE INDEX IF NOT EXISTS idx_roles_permissions_gin ON roles USING GIN (permissions);

-- Enforce that permissions are from the allowed set (subset-of)
ALTER TABLE roles
  DROP CONSTRAINT IF EXISTS roles_permissions_allowed,
  ADD CONSTRAINT roles_permissions_allowed CHECK (
    permissions <@ ARRAY[
      'VIEW_USERS','MANAGE_USERS','VIEW_ROLES','MANAGE_ROLES',
      'VIEW_PROMO_CODES','MANAGE_PROMO_CODES','VIEW_IMAGES','GENERATE_IMAGES',
      'DELETE_IMAGES','UPLOAD_FILES','VIEW_BILLING','MANAGE_BILLING',
      'VIEW_SETTINGS','MANAGE_SETTINGS','VIEW_AUDIT_LOGS'
    ]::text[]
  );

-- Normalize permissions: dedupe and sort values on insert/update
CREATE OR REPLACE FUNCTION roles_permissions_normalize() RETURNS trigger AS $$
BEGIN
  NEW.permissions := COALESCE(
    (SELECT ARRAY(
       SELECT DISTINCT p FROM unnest(COALESCE(NEW.permissions, '{}'::text[])) AS t(p)
       ORDER BY p
     )),
    '{}'::text[]
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_roles_permissions_normalize ON roles;
CREATE TRIGGER trg_roles_permissions_normalize
BEFORE INSERT OR UPDATE OF permissions ON roles
FOR EACH ROW EXECUTE FUNCTION roles_permissions_normalize();

-- If migrating from older schema, drop legacy many-to-many table
DROP TABLE IF EXISTS user_roles;

-- 3) Seed core roles with fixed IDs
INSERT INTO roles (id, name, description)
VALUES (1, 'superuser', 'Superuser (full access)')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO roles (id, name, description)
VALUES (2, 'public', 'Public user (no privileges)')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 4) Add users.role_id column (store role ID, not name)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER;

-- Ensure FK constraint exists (users.role_id -> roles.id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.table_name = 'users' AND tc.constraint_name = 'users_role_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id);
  END IF;
END $$;

-- 6) Set default to the actual 'public' role ID and fill any remaining NULLs
DO $$
DECLARE
  v_public_id INTEGER;
BEGIN
  SELECT id INTO v_public_id FROM roles WHERE id = 2;
  IF v_public_id IS NULL THEN
    RAISE EXCEPTION 'public role (id=2) not found';
  END IF;
  EXECUTE format('ALTER TABLE users ALTER COLUMN role_id SET DEFAULT %s', v_public_id);
  UPDATE users SET role_id = v_public_id WHERE role_id IS NULL;
END $$;

ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;
