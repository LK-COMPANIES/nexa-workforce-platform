-- =============================================================================
-- Nexa Workforce Solutions — Phase 4 membership-listing bootstrap function
--
-- The organization switcher (brief §12) needs "list every organization this
-- authenticated user belongs to" — a query that is inherently cross-tenant
-- (it spans every org the user has a membership in, not just the caller's
-- CURRENT tenant context). Rather than weakening organization_memberships'
-- RLS policy (which must stay strictly organization_id-scoped for every
-- other access pattern), this is the same bootstrap pattern as
-- auth_lookup_user_by_email (001) and auth_lookup_refresh_token (002): one
-- narrow SECURITY DEFINER function, safe specifically because the calling
-- application code (see apps/api/src/auth/auth.service.ts#listMemberships)
-- MUST always pass the authenticated caller's own userId — obtained from
-- their validated session, never from a request parameter — so a user can
-- only ever list their OWN memberships, never anyone else's.
-- =============================================================================

CREATE OR REPLACE FUNCTION auth_list_user_memberships(p_user_id uuid)
RETURNS TABLE (
  organization_id uuid,
  organization_display_name text,
  organization_type text,
  role_key text,
  role_name text,
  membership_status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    o.id,
    o.display_name,
    o.type::text,
    r.key,
    r.name,
    m.status::text
  FROM organization_memberships m
  JOIN organizations o ON o.id = m.organization_id
  JOIN roles r ON r.id = m.role_id
  WHERE m.user_id = p_user_id
  ORDER BY o.display_name;
$$;

REVOKE ALL ON FUNCTION auth_list_user_memberships(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_list_user_memberships(uuid) TO nexa_app;
