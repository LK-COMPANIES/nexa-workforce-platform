-- =============================================================================
-- Nexa Workforce Solutions — Phase 6 Row-Level Security
--
-- organization_memberships already has RLS from Phase 1 (001) — this file
-- adds only the bootstrap lookup function the invite-acceptance flow needs.
--
-- Same bootstrapping exception already established for
-- auth_lookup_user_by_email (001) and auth_lookup_refresh_token (002): the
-- invited user accepting an invite has no session/JWT yet, so no
-- app.current_tenant_id can be set before this lookup happens — RLS would
-- otherwise return zero rows for a legitimate accept-invite request. Safe
-- for the same reason those two are: the input is a SHA-256 hash of a
-- cryptographically random 256-bit token (packages/auth/src/refresh-
-- token.ts's pattern, reused verbatim for invites), never attacker-
-- controllable/guessable, and the function returns only what the accept-
-- invite flow needs to validate the token and then establish the correct
-- tenant context for the write that follows.
-- =============================================================================

CREATE OR REPLACE FUNCTION auth_lookup_membership_by_invite_token(p_token_hash TEXT)
RETURNS TABLE (
  membership_id uuid,
  organization_id uuid,
  user_id uuid,
  role_id uuid,
  status text,
  invite_token_expires_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    m.id,
    m.organization_id,
    m.user_id,
    m.role_id,
    m.status::text,
    m.invite_token_expires_at
  FROM organization_memberships m
  WHERE m.invite_token_hash = p_token_hash;
$$;

REVOKE ALL ON FUNCTION auth_lookup_membership_by_invite_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_membership_by_invite_token(text) TO nexa_app;
