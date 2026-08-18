import hashlib
import time

from anthropic import AsyncAnthropic, APIError
from fastapi import APIRouter, Depends, HTTPException

from ..config import get_settings
from ..db import tenant_transaction
from ..dependencies import CallerClaims, verify_caller
from ..schemas import OrchestrateRequest, OrchestrateResponse

router = APIRouter()


def _sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


@router.post("/internal/orchestrate", response_model=OrchestrateResponse)
async def orchestrate(
    body: OrchestrateRequest, caller: CallerClaims = Depends(verify_caller)
) -> OrchestrateResponse:
    """Calls Anthropic, then unconditionally records an AIAuditLog row —
    on both success and failure — before returning. The prompt and completion
    text are never persisted verbatim; only their sha256 hashes are written
    to the audit trail (input_ref / output_ref)."""
    if body.organization_id != caller.organization_id:
        raise HTTPException(status_code=403, detail="Token is not scoped to the requested organization")

    settings = get_settings()
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    input_ref = _sha256_hex(body.prompt)
    started_at = time.monotonic()

    status_value = "FAILURE"
    output_text = ""
    output_ref: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    error_summary: str | None = None

    try:
        response = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=1024,
            messages=[{"role": "user", "content": body.prompt}],
        )
        output_text = "".join(
            block.text for block in response.content if getattr(block, "type", None) == "text"
        )
        output_ref = _sha256_hex(output_text)
        prompt_tokens = response.usage.input_tokens
        completion_tokens = response.usage.output_tokens
        status_value = "SUCCESS"
    except APIError as exc:
        error_summary = str(exc)[:500]

    latency_ms = int((time.monotonic() - started_at) * 1000)

    async with tenant_transaction(caller.organization_id, caller.sub) as connection:
        row = await connection.fetchrow(
            """
            INSERT INTO ai_audit_logs (
                id, organization_id, requesting_user_id, agent_service,
                model_identifier, request_type, input_ref, output_ref,
                status, error_summary, prompt_tokens, completion_tokens,
                latency_ms, requires_human_review, created_at
            ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now()
            )
            RETURNING id
            """,
            body.organization_id,
            body.requesting_user_id,
            body.agent_service,
            settings.anthropic_model,
            body.request_type,
            input_ref,
            output_ref,
            status_value,
            error_summary,
            prompt_tokens,
            completion_tokens,
            latency_ms,
            body.requires_human_review,
        )

    if status_value == "FAILURE":
        raise HTTPException(status_code=502, detail=f"AI provider call failed: {error_summary}")

    return OrchestrateResponse(
        audit_log_id=str(row["id"]),
        status=status_value,
        output_text=output_text,
        output_ref=output_ref,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        latency_ms=latency_ms,
    )
