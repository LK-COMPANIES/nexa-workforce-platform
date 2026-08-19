-- =============================================================================
-- Nexa Workforce Solutions — Phase 4 Row-Level Security
--
-- Covers ai_jobs, added in Phase 4 for the AI orchestration service's async
-- job architecture. Applied by packages/database/scripts/apply-rls.ts after
-- 001-004, and after `prisma migrate deploy` has run the Phase 4 migration.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_jobs TO nexa_app;

-- -----------------------------------------------------------------------------
-- ai_jobs — organization-scoped like ai_audit_logs (see 001). This is the
-- backstop apps/ai's tenant_transaction() relies on: even if application code
-- ever queried without an id filter, RLS still prevents Tenant A from ever
-- seeing an ai_jobs row belonging to Tenant B.
-- -----------------------------------------------------------------------------
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_jobs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ai_jobs ON ai_jobs;
CREATE POLICY tenant_isolation_ai_jobs ON ai_jobs
  USING (organization_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_tenant_id', true)::uuid);
