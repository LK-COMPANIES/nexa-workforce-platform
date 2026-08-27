from typing import Optional

import asyncpg

# Contract types a BPO QA review is meaningful for. Mirrors ContractType in
# packages/database/prisma/schema.prisma — kept as a plain list here (not a
# shared package) since apps/ai has no dependency on the TypeScript packages
# by design (brief: FastAPI service is architecturally independent, talking
# to Postgres directly like apps/api does, not through the Node layer).
BPO_RELEVANT_CONTRACT_TYPES = ("OUTSOURCED_WORKFORCE", "CLIENT_SERVICES_AGREEMENT")


async def get_contract(connection: asyncpg.Connection, contract_id: str) -> Optional[dict]:
    """Fetches a contract by id from WITHIN an already-open tenant_transaction
    (see db.py). The query carries no organization_id filter of its own —
    tenant scope is enforced entirely by the RLS policy bound to the
    connection's `app.current_tenant_id` session GUC (packages/database/
    prisma/rls/003_phase3_payroll_and_compliance.sql covers `contracts`).

    This is the actual mechanism behind "organization_id must come from the
    JWT, never trusted from the request body": a contract_id belonging to
    another tenant is invisible to this query, full stop — there is no
    organization_id comparison to get wrong. Returns None both when the id
    does not exist and when it belongs to another tenant; the two cases are
    intentionally indistinguishable to the caller (a 404 either way), so this
    endpoint never confirms or denies another tenant's contract IDs exist.
    """
    row = await connection.fetchrow(
        """
        SELECT
            id, organization_id, employee_id, contract_type, status, title,
            reference_code, effective_date, expiration_date, base_compensation,
            currency, payment_interval, job_title, job_description,
            work_location, working_hours_per_week, probation_months,
            probation_extended_months, probation_extension_consent,
            notice_period_days, continuous_employment_date, terms
        FROM contracts
        WHERE id = $1::uuid
        """,
        contract_id,
    )
    return dict(row) if row else None


async def get_latest_compliance_evaluation(
    connection: asyncpg.Connection, contract_id: str
) -> Optional[dict]:
    """Latest deterministic Phase 3 compliance result for this contract, for
    the contract audit agent to reference (never override) in its prompt."""
    row = await connection.fetchrow(
        """
        SELECT status, score, findings, rule_engine_version, created_at
        FROM compliance_evaluations
        WHERE contract_id = $1::uuid AND subject_type = 'CONTRACT'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        contract_id,
    )
    return dict(row) if row else None
