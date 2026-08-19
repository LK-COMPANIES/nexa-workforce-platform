from typing import Literal, Optional

from pydantic import BaseModel, Field

DISCLAIMER = (
    "This is an AI-generated quality assessment of the submitted interaction "
    "transcript against the outsourced-workforce contract's service terms. "
    "It is advisory only and does not modify the contract or any statutory "
    "compliance status."
)

DEFAULT_QA_CRITERIA = [
    "Accuracy of information provided",
    "Professionalism and tone",
    "Issue resolution / first-contact resolution",
    "Adherence to documented process and escalation paths",
    "Data protection and confidentiality handling",
]


class BpoQaRequest(BaseModel):
    """organization_id is deliberately absent — see auth/jwt.py's
    CallerClaims docstring. contract_id must resolve, within the caller's own
    tenant scope, to a contract of a BPO-relevant type (OUTSOURCED_WORKFORCE
    or CLIENT_SERVICES_AGREEMENT) — see services/contract_repository.py.
    interaction_transcript is real user-submitted content being evaluated,
    not a fabricated call log — this service never invents interaction data."""

    contract_id: str = Field(min_length=1)
    interaction_transcript: str = Field(min_length=1)
    qa_criteria: Optional[list[str]] = None


class BpoQaFinding(BaseModel):
    criterion: str
    rating: Literal["MEETS", "PARTIALLY_MEETS", "DOES_NOT_MEET"]
    evidence: str
    suggestion: Optional[str] = None


class BpoQaResult(BaseModel):
    overall_score: float = Field(ge=0, le=100, description="Judgment-based QA score, not a statutory figure")
    summary: str
    findings: list[BpoQaFinding]
    compliance_flags: list[str] = Field(
        default_factory=list,
        description="e.g. 'possible data protection concern', 'escalation path not offered'",
    )
    disclaimer: str = DISCLAIMER
