-- =============================================================================
-- Nexa Workforce Solutions — Phase 3 Row-Level Security
--
-- Covers the payroll and compliance tables added in Phase 3. Applied by
-- packages/database/scripts/apply-rls.ts after 001 and 002, and after
-- `prisma migrate deploy` has run the Phase 3 migration.
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON payroll_runs, payroll_run_statutory_rules, compliance_evaluations, compliance_rule_versions TO nexa_app;

-- -----------------------------------------------------------------------------
-- payroll_runs — organization-scoped like any other tenant-owned table. This
-- is the most financially sensitive table in the system; RLS is the backstop
-- if PayrollService's own tenant-context discipline ever has a bug.
-- -----------------------------------------------------------------------------
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_payroll_runs ON payroll_runs;
CREATE POLICY tenant_isolation_payroll_runs ON payroll_runs
  USING (organization_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_tenant_id', true)::uuid);

-- -----------------------------------------------------------------------------
-- payroll_run_statutory_rules — no organization_id of its own; tenant scope
-- is derived from its parent payroll_runs row, same pattern as
-- refresh_tokens deriving scope from sessions (see 002).
-- -----------------------------------------------------------------------------
ALTER TABLE payroll_run_statutory_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_run_statutory_rules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_payroll_run_statutory_rules ON payroll_run_statutory_rules;
CREATE POLICY tenant_isolation_payroll_run_statutory_rules ON payroll_run_statutory_rules
  USING (
    EXISTS (
      SELECT 1 FROM payroll_runs pr
      WHERE pr.id = payroll_run_statutory_rules.payroll_run_id
        AND pr.organization_id = current_setting('app.current_tenant_id', true)::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM payroll_runs pr
      WHERE pr.id = payroll_run_statutory_rules.payroll_run_id
        AND pr.organization_id = current_setting('app.current_tenant_id', true)::uuid
    )
  );

-- -----------------------------------------------------------------------------
-- compliance_evaluations — organization-scoped, append-only at the
-- application layer (see ComplianceService — it only ever INSERTs).
-- -----------------------------------------------------------------------------
ALTER TABLE compliance_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_evaluations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_compliance_evaluations ON compliance_evaluations;
CREATE POLICY tenant_isolation_compliance_evaluations ON compliance_evaluations
  USING (organization_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_tenant_id', true)::uuid);

-- -----------------------------------------------------------------------------
-- compliance_rule_versions — platform-global reference data (like
-- statutory_rule_versions), intentionally left without an RLS policy.
-- -----------------------------------------------------------------------------
