import pytest
from pydantic import ValidationError

from app.schemas.bpo_qa import BpoQaFinding, BpoQaResult
from app.schemas.contract_audit import ContractAuditFinding, ContractAuditResult


def test_contract_audit_finding_rejects_invalid_severity():
    with pytest.raises(ValidationError):
        ContractAuditFinding(
            category="termination_clause", severity="ERROR", observation="o", recommendation="r"
        )


def test_contract_audit_result_accepts_valid_payload_and_defaults_disclaimer():
    result = ContractAuditResult(
        summary="Overall the contract is clear.",
        overall_assessment="LOOKS_SOUND",
        findings=[
            ContractAuditFinding(
                category="termination_clause", severity="INFO", observation="o", recommendation="r"
            )
        ],
    )
    assert "advisory" in result.disclaimer.lower()


def test_contract_audit_result_rejects_invalid_overall_assessment():
    with pytest.raises(ValidationError):
        ContractAuditResult(summary="s", overall_assessment="PERFECT", findings=[])


def test_bpo_qa_result_rejects_score_above_100():
    with pytest.raises(ValidationError):
        BpoQaResult(overall_score=150, summary="s", findings=[])


def test_bpo_qa_result_rejects_score_below_0():
    with pytest.raises(ValidationError):
        BpoQaResult(overall_score=-1, summary="s", findings=[])


def test_bpo_qa_result_accepts_boundary_scores():
    for score in (0, 100):
        result = BpoQaResult(overall_score=score, summary="s", findings=[])
        assert result.overall_score == score
        assert result.compliance_flags == []


def test_bpo_qa_finding_rejects_invalid_rating():
    with pytest.raises(ValidationError):
        BpoQaFinding(criterion="Professionalism", rating="GOOD", evidence="e")


def test_bpo_qa_finding_accepts_valid_rating_without_suggestion():
    finding = BpoQaFinding(
        criterion="Professionalism", rating="MEETS", evidence="Agent was courteous throughout."
    )
    assert finding.suggestion is None
