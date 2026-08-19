from typing import Optional

import asyncpg


async def create_job(
    connection: asyncpg.Connection,
    *,
    organization_id: str,
    requested_by_user_id: str,
    agent_type: str,
    prompt_version: str,
    subject_contract_id: Optional[str],
) -> dict:
    row = await connection.fetchrow(
        """
        INSERT INTO ai_jobs (
            id, organization_id, requested_by_user_id, agent_type, status,
            prompt_version, subject_contract_id, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), $1, $2, $3::"AiAgentType", 'PENDING', $4, $5, now(), now()
        )
        RETURNING id, organization_id, agent_type, status, prompt_version, created_at, completed_at
        """,
        organization_id,
        requested_by_user_id,
        agent_type,
        prompt_version,
        subject_contract_id,
    )
    return dict(row)


async def mark_running(connection: asyncpg.Connection, job_id: str) -> None:
    await connection.execute(
        """UPDATE ai_jobs SET status = 'RUNNING', updated_at = now() WHERE id = $1::uuid""",
        job_id,
    )


async def mark_succeeded(
    connection: asyncpg.Connection, job_id: str, *, result: dict, audit_log_id: str
) -> None:
    await connection.execute(
        """
        UPDATE ai_jobs
        SET status = 'SUCCEEDED', result_json = $2::jsonb, audit_log_id = $3::uuid,
            completed_at = now(), updated_at = now()
        WHERE id = $1::uuid
        """,
        job_id,
        result,
        audit_log_id,
    )


async def mark_failed(
    connection: asyncpg.Connection, job_id: str, *, error_summary: str, audit_log_id: Optional[str]
) -> None:
    await connection.execute(
        """
        UPDATE ai_jobs
        SET status = 'FAILED', error_summary = $2, audit_log_id = $3::uuid,
            completed_at = now(), updated_at = now()
        WHERE id = $1::uuid
        """,
        job_id,
        error_summary[:1000],
        audit_log_id,
    )


async def get_job(connection: asyncpg.Connection, job_id: str) -> Optional[dict]:
    """RLS-scoped like get_contract() above — a job_id belonging to another
    tenant is invisible here, not merely filtered by a WHERE clause we could
    forget to write."""
    row = await connection.fetchrow(
        """
        SELECT id, organization_id, requested_by_user_id, agent_type, status,
               prompt_version, subject_contract_id, result_json, error_summary,
               created_at, completed_at
        FROM ai_jobs
        WHERE id = $1::uuid
        """,
        job_id,
    )
    return dict(row) if row else None
