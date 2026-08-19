from typing import Literal

from pydantic import BaseModel, Field

DISCLAIMER = (
    "This is AI-generated advisory analysis, not legal advice, and is "
    "distinct from the deterministic Employment Act 2007 compliance "
    "evaluation produced by the Phase 3 rule engine."
)


class ContractAuditRequest(BaseModel):
    """organization_id is deliberately absent — see auth/jwt.py's
    CallerClaims docstring. contract_id is resolved against the caller's own
    tenant scope only (services/contract_repository.py), so a contract_id
    belonging to another organization simply will not be found."""

    contract_id: str = Field(min_length=1)


class ContractAuditFinding(BaseModel):
    category: str = Field(
        description="e.g. termination_clause, compensation_clarity, ambiguous_language, scope_of_duties"
    )
    # Deliberately a different vocabulary from the deterministic engine's
    # PASS/WARNING/FAIL/REQUIRES_HUMAN_REVIEW (see @nexa/validation
    # complianceStatusSchema / apps/api compliance engine) so the two
    # result types can never be visually or programmatically confused.
    severity: Literal["INFO", "ADVISORY", "CONCERN"]
    observation: str
    recommendation: str


class ContractAuditResult(BaseModel):
    summary: str
    overall_assessment: Literal["LOOKS_SOUND", "MINOR_SUGGESTIONS", "SIGNIFICANT_CONCERNS"]
    findings: list[ContractAuditFinding]
    disclaimer: str = DISCLAIMER
