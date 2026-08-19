from fastapi import APIRouter, Depends, HTTPException, status

from ..auth import CallerClaims, verify_caller
from ..db import tenant_transaction
from ..schemas.jobs import JobStatusResponse
from ..services import ai_job_repository

router = APIRouter(prefix="/agents/jobs", tags=["ai-jobs"])


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str, caller: CallerClaims = Depends(verify_caller)) -> JobStatusResponse:
    """RLS-scoped by caller.organization_id exactly like the agent create
    endpoints — a job_id belonging to another tenant 404s here too."""
    async with tenant_transaction(caller.organization_id, caller.sub) as connection:
        job = await ai_job_repository.get_job(connection, job_id)

    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    return JobStatusResponse(
        job_id=str(job["id"]),
        agent_type=job["agent_type"],
        status=job["status"],
        prompt_version=job["prompt_version"],
        result=job["result_json"],
        error=job["error_summary"],
        created_at=job["created_at"],
        completed_at=job["completed_at"],
    )
