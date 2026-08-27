from typing import Optional

import asyncpg
from pydantic import BaseModel

from ..services import ai_job_repository, audit_repository


async def finalize_success(
    connection: asyncpg.Connection,
    *,
    job_id: str,
    organization_id: str,
    requesting_user_id: Optional[str],
    agent_service: str,
    model_identifier: str,
    request_type: str,
    input_text: str,
    output: BaseModel,
    prompt_tokens: int,
    completion_tokens: int,
    latency_ms: int,
    requires_human_review: bool,
) -> dict:
    """Writes the AIAuditLog row and the AiJob's terminal SUCCEEDED update in
    the same transaction — both records exist, or neither does, on every
    orchestration attempt (brief: unconditional AI audit logging)."""
    result_dict = output.model_dump(mode="json")
    output_ref = audit_repository.sha256_hex(str(result_dict))

    audit_log_id = await audit_repository.record_audit_log(
        connection,
        organization_id=organization_id,
        requesting_user_id=requesting_user_id,
        agent_service=agent_service,
        model_identifier=model_identifier,
        request_type=request_type,
        input_ref=audit_repository.sha256_hex(input_text),
        output_ref=output_ref,
        status="SUCCESS",
        error_summary=None,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        latency_ms=latency_ms,
        requires_human_review=requires_human_review,
    )
    await ai_job_repository.mark_succeeded(connection, job_id, result=result_dict, audit_log_id=audit_log_id)
    return result_dict


async def finalize_failure(
    connection: asyncpg.Connection,
    *,
    job_id: str,
    organization_id: str,
    requesting_user_id: Optional[str],
    agent_service: str,
    model_identifier: str,
    request_type: str,
    input_text: str,
    error_summary: str,
    latency_ms: int,
) -> None:
    audit_log_id = await audit_repository.record_audit_log(
        connection,
        organization_id=organization_id,
        requesting_user_id=requesting_user_id,
        agent_service=agent_service,
        model_identifier=model_identifier,
        request_type=request_type,
        input_ref=audit_repository.sha256_hex(input_text),
        output_ref=None,
        status="FAILURE",
        error_summary=error_summary[:500],
        prompt_tokens=None,
        completion_tokens=None,
        latency_ms=latency_ms,
        requires_human_review=False,
    )
    await ai_job_repository.mark_failed(
        connection, job_id, error_summary=error_summary, audit_log_id=audit_log_id
    )
