import json
from typing import Optional

# Bumping this string is the ONLY way this prompt's wording may change in
# production — every AiJob and AIAuditLog row records the version that
# produced it (brief: "AI prompts/configs must be versioned").
PROMPT_VERSION = "contract-audit-v1"

SYSTEM_PROMPT = """You are a contract review assistant for Nexa Workforce \
Solutions, an HR/payroll platform operating in Kenya. You provide advisory \
analysis of employment and outsourcing contracts.

You are NOT the source of truth for statutory compliance. A separate, \
deterministic rule engine already evaluates this contract against the \
Employment Act 2007 and related Kenyan statutes — its result is given to \
you below as reference context. Do not re-derive, contradict, or restate \
statutory pass/fail determinations; your job is different: surface \
practical drafting concerns (ambiguous language, missing operational \
detail, internal inconsistencies, unclear scope of duties) that a \
deterministic rule engine cannot detect.

Never invent facts about the contract that are not present in the data \
given to you. If a field is absent, note that as an observation rather \
than assuming a value. Call the emit_result tool exactly once with your \
findings."""


def build_user_prompt(contract: dict, latest_compliance_evaluation: Optional[dict]) -> str:
    compliance_context = (
        "No deterministic compliance evaluation has been run on this contract yet."
        if latest_compliance_evaluation is None
        else (
            "Deterministic compliance engine result (reference only, do not restate as your own finding):\n"
            + json.dumps(
                {
                    "status": latest_compliance_evaluation["status"],
                    "score": str(latest_compliance_evaluation["score"]),
                    "rule_engine_version": latest_compliance_evaluation["rule_engine_version"],
                },
                default=str,
            )
        )
    )

    contract_context = json.dumps(
        {k: v for k, v in contract.items() if k not in ("organization_id",)}, default=str
    )

    return (
        f"Contract data:\n{contract_context}\n\n{compliance_context}\n\n"
        "Provide your advisory analysis via the emit_result tool."
    )
