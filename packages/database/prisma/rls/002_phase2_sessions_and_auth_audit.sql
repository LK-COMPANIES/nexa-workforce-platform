-- =============================================================================
-- Nexa Workforce Solutions — Phase 2 Row-Level Security
--
-- Adds RLS coverage for the Phase 2 authentication tables (sessions,
-- refresh_tokens, authentication_audit_events). Applied by
-- packages/database/scripts/apply-rls.ts AFTER 001_enable_row_level_security.sql
-- and after `prisma migrate deploy` has created these tables.
--
-- Bootstrapping exception (same pattern as 001's auth_lookup_user_by_email):
-- validating a refresh token happens BEFORE tenant context is known — that's
-- the whole point of hitting POST /auth/refresh, the caller only has an
-- opaque token, not an organization_id it's entitled to claim. A single
-- SECURITY DEFINER function, auth_lookup_refresh_token, is the sole
-- sanctioned way to resolve a token hash to its session/user/organization
-- outside tenant context. Every other access to these tables — issuing a new
-- token pair, revoking a session, an admin listing active sessions — goes
-- through the normal RLS-constrained path once organization_id is known.
-- =============================================================================

-- 001_enable_row_level_security.sql's `ALTER DEFAULT PRIVILEGES` only covers
-- tables created afterward BY THE SAME ROLE that ran it. That's true here in
-- practice (both scripts run via the owner/DIRECT_DATABASE_URL connection),
-- but explicit grants are cheap insurance against that assumption drifting.
GRANT SELECT, INSERT, UPDATE, DELETE ON sessions, refresh_tokens, authentication_audit_events, engagement_types TO nexa_app;

-- -----------------------------------------------------------------------------
-- sessions — organization-scoped like any other tenant-owned table.
-- -----------------------------------------------------------------------------
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_sessions ON sessions;
CREATE POLICY tenant_isolation_sessions ON sessions
  USING (organization_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_tenant_id', true)::uuid);

-- -----------------------------------------------------------------------------
-- refresh_tokens — has no organization_id column of its own (a refresh token
-- is resolved TO a tenant, not created with one already known — see the
-- bootstrap exception above). Tenant scope is derived from its parent
-- session via a subquery, so normal (post-bootstrap) reads/writes are still
-- fully tenant-isolated at the database layer, not merely by convention.
-- -----------------------------------------------------------------------------
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_refresh_tokens ON refresh_tokens;
CREATE POLICY tenant_isolation_refresh_tokens ON refresh_tokens
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = refresh_tokens.session_id
        AND s.organization_id = current_setting('app.current_tenant_id', true)::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = refresh_tokens.session_id
        AND s.organization_id = current_setting('app.current_tenant_id', true)::uuid
    )
  );

-- Bootstrap path for POST /auth/refresh, before tenant context exists.
-- Returns only what the refresh flow needs to validate the token and then
-- establish the correct tenant context for issuing a replacement pair.
CREATE OR REPLACE FUNCTION auth_lookup_refresh_token(p_token_hash TEXT)
RETURNS TABLE (
  refresh_token_id uuid,
  family_id uuid,
  refresh_token_status text,
  refresh_token_expires_at timestamptz,
  session_id uuid,
  session_status text,
  session_expires_at timestamptz,
  is_super_admin_session boolean,
  user_id uuid,
  organization_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    rt.id,
    rt.family_id,
    rt.status::text,
    rt.expires_at,
    s.id,
    s.status::text,
    s.expires_at,
    s.is_super_admin_session,
    s.user_id,
    s.organization_id
  FROM refresh_tokens rt
  JOIN sessions s ON s.id = rt.session_id
  WHERE rt.token_hash = p_token_hash;
$$;

REVOKE ALL ON FUNCTION auth_lookup_refresh_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_refresh_token(text) TO nexa_app;

-- -----------------------------------------------------------------------------
-- authentication_audit_events — organization-scoped like sessions. Every
-- authentication event (including failures) carries a claimed
-- organizationId from the request itself, so — unlike refresh token lookup —
-- no bootstrap exception is needed here; the write happens inside the same
-- runWithTenant(claimedOrganizationId, ...) block used to validate the
-- login/refresh attempt in the first place.
-- -----------------------------------------------------------------------------
ALTER TABLE authentication_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE authentication_audit_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_authentication_audit_events ON authentication_audit_events;
CREATE POLICY tenant_isolation_authentication_audit_events ON authentication_audit_events
  USING (organization_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_tenant_id', true)::uuid);

-- -----------------------------------------------------------------------------
-- engagement_types — platform-global reference data (like roles/permissions/
-- statutory_jurisdictions), intentionally left without an RLS policy.
-- -----------------------------------------------------------------------------
