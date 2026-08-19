import json

from ...schemas.bpo_qa import DEFAULT_QA_CRITERIA

PROMPT_VERSION = "bpo-qa-v1"

SYSTEM_PROMPT = """You are a BPO quality-assurance reviewer for Nexa \
Workforce Solutions, evaluating a single customer/client interaction \
transcript submitted by an operations manager against the service terms \
of an outsourced-workforce or client-services contract.

Score and evaluate ONLY what is present in the submitted transcript. Do \
not assume information about the agent, the client, or prior interactions \
that is not stated in the transcript. If the transcript is too short or \
ambiguous to assess a criterion, rate it DOES_NOT_MEET with evidence \
explaining why, rather than guessing favorably.

Flag anything in the transcript that raises a data protection, \
confidentiality, or contractual-scope concern in compliance_flags — this \
is advisory triage for a human reviewer, not a legal or statutory \
determination. Call the emit_result tool exactly once."""


def build_user_prompt(contract: dict, interaction_transcript: str, qa_criteria: list[str] | None) -> str:
    criteria = qa_criteria or DEFAULT_QA_CRITERIA
    contract_context = json.dumps(
        {
            "contract_type": contract["contract_type"],
            "title": contract["title"],
            "job_title": contract.get("job_title"),
            "work_location": contract.get("work_location"),
        },
        default=str,
    )

    return (
        f"Contract context (for scope only, not the subject of review):\n{contract_context}\n\n"
        f"QA criteria to evaluate:\n{json.dumps(criteria)}\n\n"
        f"Interaction transcript submitted for review:\n---\n{interaction_transcript}\n---\n\n"
        "Provide your QA assessment via the emit_result tool."
    )
