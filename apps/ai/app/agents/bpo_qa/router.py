from fastapi import APIRouter, BackgroundTasks, Depends, status

from ...auth import CallerClaims, verify_caller
from ...middleware.rate_limit import enforce_rate_limit
from ...middleware.request_size import enforce_max_body_size
from ...schemas.bpo_qa import BpoQaRequest
from ...schemas.jobs import JobAccepted
from . import agent

router = APIRouter(prefix="/agents/bpo-qa", tags=["bpo-qa"], dependencies=[Depends(enforce_max_body_size)])


@router.post("", response_model=JobAccepted, status_code=status.HTTP_202_ACCEPTED)
async def start_bpo_qa(
    body: BpoQaRequest,
    background_tasks: BackgroundTasks,
    caller: CallerClaims = Depends(verify_caller),
    _rate_limit: None = Depends(enforce_rate_limit),
) -> JobAccepted:
    """Same tenant-isolation guarantee as contract-audit: organization_id is
    never accepted in `body` (BpoQaRequest has no such field) — only
    caller.organization_id, from the verified JWT, scopes this request."""
    job = await agent.create_job(
        organization_id=caller.organization_id,
        user_id=caller.sub,
        contract_id=body.contract_id,
        interaction_transcript=body.interaction_transcript,
        qa_criteria=body.qa_criteria,
    )
    background_tasks.add_task(
        agent.execute_job,
        job_id=str(job["id"]),
        organization_id=caller.organization_id,
        user_id=caller.sub,
        contract_id=body.contract_id,
        interaction_transcript=body.interaction_transcript,
        qa_criteria=body.qa_criteria,
    )
    return JobAccepted(job_id=str(job["id"]), status=job["status"])
