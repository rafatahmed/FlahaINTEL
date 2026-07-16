-- FlahaINTEL Phase 3M PostgreSQL roles (run as superuser once)
-- Application runtime uses least-privilege role; migrations use a separate migrator role.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'flaha_migrator') THEN
    CREATE ROLE flaha_migrator LOGIN PASSWORD 'CHANGE_ME_MIGRATOR';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'flaha_app') THEN
    CREATE ROLE flaha_app LOGIN PASSWORD 'CHANGE_ME_APP';
  END IF;
END$$;

-- Create database owned by migrator if missing (run outside DO if needed):
-- CREATE DATABASE flaha_intel OWNER flaha_migrator;

\connect flaha_intel

GRANT CONNECT ON DATABASE flaha_intel TO flaha_app;
GRANT USAGE ON SCHEMA public TO flaha_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO flaha_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO flaha_app;
ALTER DEFAULT PRIVILEGES FOR ROLE flaha_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO flaha_app;
ALTER DEFAULT PRIVILEGES FOR ROLE flaha_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO flaha_app;

-- Runtime role must not be superuser / bypassrls / createdb
ALTER ROLE flaha_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
ALTER ROLE flaha_migrator NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- Recommended session guards (set in postgresql.conf or ALTER ROLE):
-- ALTER ROLE flaha_app SET statement_timeout = '30s';
-- ALTER ROLE flaha_app SET lock_timeout = '10s';
-- ALTER ROLE flaha_app SET idle_in_transaction_session_timeout = '60s';
