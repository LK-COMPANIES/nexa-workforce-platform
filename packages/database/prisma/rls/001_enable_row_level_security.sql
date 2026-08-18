-- =============================================================================
-- Nexa Workforce Solutions — Row-Level Security
--
-- This file is NOT a Prisma migration; Prisma has no declarative way to
-- express RLS policies. It is applied as a separate, explicit deploy step
-- (see packages/database/scripts/apply-rls.ts and the root `db:rls` /
-- `db:deploy` scripts) AFTER `prisma migrate deploy` has created the tables.
--
-- Prerequisite: `prisma migrate deploy` has already run against this database
-- using a privileged/owner connection (DIRECT_DATABASE_URL).
--
-- Roles established here:
--   nexa_app  — the role the running application (NestJS API, FastAPI AI
--               service) connects as for all normal request traffic. RLS
--               applies to it in full (FORCE ROW LEVEL SECURITY).
--
-- Tenant context contract (see packages/database/src/tenant-context.ts):
--   Every request that touches tenant-scoped data MUST run inside a
--   transaction that starts with:
--     SET LOCAL app.current_tenant_id = '<organization uuid>';
--     SET LOCAL app.current_user_id   = '<user uuid>';        -- optional, see users policy
--   `current_setting(..., true)` returns NULL when unset, and NULL never
--   equals anything in SQL — so a forgotten SET LOCAL fails CLOSED (zero
--   rows / zero writes), not open.
--
-- Bootstrapping exception: authenticating a login request happens BEFORE a
-- tenant is known (the app doesn't yet know which organization the user will
-- operate in). Rather than weakening the `users` RLS policy to allow this,
-- a single narrowly-scoped SECURITY DEFINER function
-- (`auth_lookup_user_by_email`) is the sole sanctioned way to read a user row
-- outside tenant context, and it returns only the columns authentication
-- needs. Everything else — profile reads, admin user listings — goes through
-- the normal RLS-constrained path.
--
-- Prerequisite: the `nexa_app` role itself is created (with its password and
-- NOSUPERUSER/NOBYPASSRLS/NOCREATEDB/NOCREATEROLE attributes) by
-- packages/database/scripts/apply-rls.ts BEFORE this file runs — a role
-- password is a secret and does not belong in a source-controlled SQL file.
-- =============================================================================

GRANT USAGE ON SCHEMA public TO nexa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nexa_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nexa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nexa_app;

-- -----------------------------------------------------------------------------
-- organizations — a row IS a tenant. Visible only when it IS the current
-- tenant. (Cross-tenant hierarchy visibility, e.g. a parent org browsing its
-- children, is an intentional Phase 2 policy refinement — see docs/tenant-isolation.md.)
-- -----------------------------------------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_organizations ON organizations;
CREATE POLICY tenant_isolation_organizations ON organizations
  USING (id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (id = current_setting('app.current_tenant_id', true)::uuid);

-- -----------------------------------------------------------------------------
-- users — global identity, not tenant-owned. Visible when the row is the
-- caller's own user, OR the user shares an ACTIVE membership with the
-- current tenant (so, e.g., a Client_Admin can list co-workers in their org).
-- -----------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_scoped_users ON users;
CREATE POLICY tenant_scoped_users ON users
  USING (
    id = current_setting('app.current_user_id', true)::uuid
    OR EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.user_id = users.id
        AND m.organization_id = current_setting('app.current_tenant_id', true)::uuid
        AND m.status = 'ACTIVE'
    )
  )
  WITH CHECK (id = current_setting('app.current_user_id', true)::uuid);

-- Bootstrap path for authentication, before tenant/user context exists.
-- Returns only what a login flow needs — never a full row, never a broad grant.
CREATE OR REPLACE FUNCTION auth_lookup_user_by_email(p_email TEXT)
RETURNS TABLE (
  id uuid,
  email text,
  password_hash text,
  is_active boolean,
  is_platform_super_admin boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id, email, password_hash, is_active, is_platform_super_admin
  FROM users
  WHERE email = p_email;
$$;

REVOKE ALL ON FUNCTION auth_lookup_user_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_user_by_email(text) TO nexa_app;

-- -----------------------------------------------------------------------------
-- organization_memberships — tenant-scoped by organization_id.
-- -----------------------------------------------------------------------------
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_organization_memberships ON organization_memberships;
CREATE POLICY tenant_isolation_organization_memberships ON organization_memberships
  USING (organization_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_tenant_id', true)::uuid);

-- -----------------------------------------------------------------------------
-- employees
-- -----------------------------------------------------------------------------
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_employees ON employees;
CREATE POLICY tenant_isolation_employees ON employees
  USING (organization_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_tenant_id', true)::uuid);

-- -----------------------------------------------------------------------------
-- contracts
-- -----------------------------------------------------------------------------
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_contracts ON contracts;
CREATE POLICY tenant_isolation_contracts ON contracts
  USING (organization_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_tenant_id', true)::uuid);

-- -----------------------------------------------------------------------------
-- payroll_records — the most sensitive tenant-scoped table in Phase 1.
-- -----------------------------------------------------------------------------
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_payroll_records ON payroll_records;
CREATE POLICY tenant_isolation_payroll_records ON payroll_records
  USING (organization_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_tenant_id', true)::uuid);

-- -----------------------------------------------------------------------------
-- ai_audit_logs
-- -----------------------------------------------------------------------------
ALTER TABLE ai_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ai_audit_logs ON ai_audit_logs;
CREATE POLICY tenant_isolation_ai_audit_logs ON ai_audit_logs
  USING (organization_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_tenant_id', true)::uuid);

-- -----------------------------------------------------------------------------
-- Platform-global reference data (roles, permissions, role_permissions,
-- statutory_jurisdictions, statutory_rule_versions) is intentionally NOT
-- tenant-owned and is left readable without an RLS policy — it carries no
-- organization_id and is shared across all tenants by design.
-- -----------------------------------------------------------------------------
