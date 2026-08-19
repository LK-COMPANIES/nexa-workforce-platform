import logging
import time
from typing import Optional

from fastapi import HTTPException, status

from ...config import get_settings
from ...db import tenant_transaction
from ...orchestration import audit as orchestration_audit
from ...orchestration.client import StructuredCallError, call_structured
from ...orchestration.prompts.bpo_qa_v1 import PROMPT_VERSION, SYSTEM_PROMPT, build_user_prompt
from ...schemas.bpo_qa import BpoQaResult
from ...services import ai_job_repository, contract_repository

logger = logging.getLogger("nexa.ai.bpo_qa")

AGENT_SERVICE = "bpo-qa"
REQUEST_TYPE = "bpo_interaction_qa_review"


async def create_job(
    *, organization_id: str, user_id: str, contract_id: str, interaction_transcript: str, qa_criteria: Optional[list[str]]
) -> dict:
    async with tenant_transaction(organization_id, user_id) as connection:
        contract = await contract_repository.get_contract(connection, contract_id)
        if contract is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
        if contract["contract_type"] not in contract_repository.BPO_RELEVANT_CONTRACT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="BPO QA review only applies to OUTSOURCED_WORKFORCE or CLIENT_SERVICES_AGREEMENT contracts",
            )

        job = await ai_job_repository.create_job(
            connection,
            organization_id=organization_id,
            requested_by_user_id=user_id,
            agent_type="BPO_QA",
            prompt_version=PROMPT_VERSION,
            subject_contract_id=contract_id,
        )
    return job


async def execute_job(
    *,
    job_id: str,
    organization_id: str,
    user_id: str,
    contract_id: str,
    interaction_transcript: str,
    qa_criteria: Optional[list[str]],
) -> None:
    settings = get_settings()
    started_at = time.monotonic()

    async with tenant_transaction(organization_id, user_id) as connection:
        await ai_job_repository.mark_running(connection, job_id)
        contract = await contract_repository.get_contract(connection, contract_id)
        if contract is None:
            await ai_job_repository.mark_failed(
                connection, job_id, error_summary="Contract no longer accessible", audit_log_id=None
            )
            return

    user_prompt = build_user_prompt(contract, interaction_transcript, qa_criteria)
    input_text = SYSTEM_PROMPT + user_prompt

    try:
        result = await call_structured(
            model=settings.anthropic_model_bpo_qa,
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            output_schema=BpoQaResult,
        )
    except StructuredCallError as exc:
        latency_ms = int((time.monotonic() - started_at) * 1000)
        logger.warning("bpo qa job %s failed: %s", job_id, exc)
        async with tenant_transaction(organization_id, user_id) as connection:
            await orchestration_audit.finalize_failure(
                connection,
                job_id=job_id,
                organization_id=organization_id,
                requesting_user_id=user_id,
                agent_service=AGENT_SERVICE,
                model_identifier=settings.anthropic_model_bpo_qa,
                request_type=REQUEST_TYPE,
                input_text=input_text,
                error_summary=str(exc),
                latency_ms=latency_ms,
            )
        return

    requires_review = len(result.output.compliance_flags) > 0
    async with tenant_transaction(organization_id, user_id) as connection:
        await orchestration_audit.finalize_success(
            connection,
            job_id=job_id,
            organization_id=organization_id,
            requesting_user_id=user_id,
            agent_service=AGENT_SERVICE,
            model_identifier=settings.anthropic_model_bpo_qa,
            request_type=REQUEST_TYPE,
            input_text=input_text,
            output=result.output,
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            latency_ms=result.latency_ms,
            requires_human_review=requires_review,
        )
