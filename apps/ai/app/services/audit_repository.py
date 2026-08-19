import hashlib
from typing import Optional

import asyncpg


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


async def record_audit_log(
    connection: asyncpg.Connection,
    *,
    organization_id: str,
    requesting_user_id: Optional[str],
    agent_service: str,
    model_identifier: str,
    request_type: str,
    input_ref: str,
    output_ref: Optional[str],
    status: str,
    error_summary: Optional[str],
    prompt_tokens: Optional[int],
    completion_tokens: Optional[int],
    latency_ms: int,
    requires_human_review: bool,
) -> str:
    """Writes the immutable AIAuditLog governance record (brief: "AI audit
    logging via the existing AIAuditLog architecture"). Only hashes of the
    prompt/output are stored (input_ref/output_ref) — never raw text, per
    the model's own docstring in schema.prisma. Called exactly once per
    orchestration attempt, success or failure, by orchestration/client.py."""
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
        organization_id,
        requesting_user_id,
        agent_service,
        model_identifier,
        request_type,
        input_ref,
        output_ref,
        status,
        error_summary,
        prompt_tokens,
        completion_tokens,
        latency_ms,
        requires_human_review,
    )
    return str(row["id"])
