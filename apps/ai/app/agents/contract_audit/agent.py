import logging
import time

from fastapi import HTTPException, status

from ...config import get_settings
from ...db import tenant_transaction
from ...orchestration import audit as orchestration_audit
from ...orchestration.client import StructuredCallError, call_structured
from ...orchestration.prompts.contract_audit_v1 import PROMPT_VERSION, SYSTEM_PROMPT, build_user_prompt
from ...schemas.contract_audit import ContractAuditResult
from ...services import ai_job_repository, contract_repository

logger = logging.getLogger("nexa.ai.contract_audit")

AGENT_SERVICE = "contract-audit"
REQUEST_TYPE = "contract_advisory_review"


async def create_job(*, organization_id: str, user_id: str, contract_id: str) -> dict:
    """Synchronous half of the request: validates the contract exists (and
    belongs to the caller's tenant, enforced by RLS — see
    contract_repository.get_contract) and creates the PENDING AiJob row.
    Kept fast and synchronous so an invalid contract_id 404s immediately
    instead of surfacing only once the background job later fails."""
    async with tenant_transaction(organization_id, user_id) as connection:
        contract = await contract_repository.get_contract(connection, contract_id)
        if contract is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

        job = await ai_job_repository.create_job(
            connection,
            organization_id=organization_id,
            requested_by_user_id=user_id,
            agent_type="CONTRACT_AUDIT",
            prompt_version=PROMPT_VERSION,
            subject_contract_id=contract_id,
        )
    return job


async def execute_job(*, job_id: str, organization_id: str, user_id: str, contract_id: str) -> None:
    """The async unit of work scheduled via FastAPI BackgroundTasks — runs
    on the same event loop after the 202 response for create_job's caller
    has already been sent, so the HTTP request is never blocked on the
    Claude call. organization_id/user_id are the values captured from the
    caller's verified JWT at request time (see routers/contract_audit.py) —
    this function never re-derives tenant scope from anything else, and
    opens its own tenant_transaction/RLS context exactly as any other
    tenant-scoped operation would.
    """
    settings = get_settings()
    started_at = time.monotonic()

    async with tenant_transaction(organization_id, user_id) as connection:
        await ai_job_repository.mark_running(connection, job_id)

        contract = await contract_repository.get_contract(connection, contract_id)
        if contract is None:
            # Contract was visible moments ago during create_job's own
            # RLS-scoped read; disappearing here would mean it was deleted
            # or reassigned between requests. Fail the job rather than crash.
            await ai_job_repository.mark_failed(
                connection, job_id, error_summary="Contract no longer accessible", audit_log_id=None
            )
            return

        latest_evaluation = await contract_repository.get_latest_compliance_evaluation(connection, contract_id)
        user_prompt = build_user_prompt(contract, latest_evaluation)

    input_text = SYSTEM_PROMPT + user_prompt

    try:
        result = await call_structured(
            model=settings.anthropic_model_contract_audit,
            system_prompt=SYSTEM_PROMPT,
            user_prompt=user_prompt,
            output_schema=ContractAuditResult,
        )
    except StructuredCallError as exc:
        latency_ms = int((time.monotonic() - started_at) * 1000)
        logger.warning("contract audit job %s failed: %s", job_id, exc)
        async with tenant_transaction(organization_id, user_id) as connection:
            await orchestration_audit.finalize_failure(
                connection,
                job_id=job_id,
                organization_id=organization_id,
                requesting_user_id=user_id,
                agent_service=AGENT_SERVICE,
                model_identifier=settings.anthropic_model_contract_audit,
                request_type=REQUEST_TYPE,
                input_text=input_text,
                error_summary=str(exc),
                latency_ms=latency_ms,
            )
        return

    requires_review = result.output.overall_assessment == "SIGNIFICANT_CONCERNS"
    async with tenant_transaction(organization_id, user_id) as connection:
        await orchestration_audit.finalize_success(
            connection,
            job_id=job_id,
            organization_id=organization_id,
            requesting_user_id=user_id,
            agent_service=AGENT_SERVICE,
            model_identifier=settings.anthropic_model_contract_audit,
            request_type=REQUEST_TYPE,
            input_text=input_text,
            output=result.output,
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            latency_ms=result.latency_ms,
            requires_human_review=requires_review,
        )
