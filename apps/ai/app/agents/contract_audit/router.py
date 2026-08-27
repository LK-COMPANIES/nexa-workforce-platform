from fastapi import APIRouter, BackgroundTasks, Depends, status

from ...auth import CallerClaims, verify_caller
from ...middleware.rate_limit import enforce_rate_limit
from ...middleware.request_size import enforce_max_body_size
from ...schemas.contract_audit import ContractAuditRequest
from ...schemas.jobs import JobAccepted
from . import agent

router = APIRouter(
    prefix="/agents/contract-audit", tags=["contract-audit"], dependencies=[Depends(enforce_max_body_size)]
)


@router.post("", response_model=JobAccepted, status_code=status.HTTP_202_ACCEPTED)
async def start_contract_audit(
    body: ContractAuditRequest,
    background_tasks: BackgroundTasks,
    caller: CallerClaims = Depends(verify_caller),
    _rate_limit: None = Depends(enforce_rate_limit),
) -> JobAccepted:
    """organization_id is never read from `body` — it does not even have
    that field (see ContractAuditRequest). Tenant scope for this entire
    request comes exclusively from `caller.organization_id`, resolved by
    verify_caller from the signed JWT. A contract_id that does not belong
    to caller's organization simply will not be found (RLS) and this
    endpoint 404s — see agent.create_job / contract_repository.get_contract.
    """
    job = await agent.create_job(
        organization_id=caller.organization_id,
        user_id=caller.sub,
        contract_id=body.contract_id,
    )
    background_tasks.add_task(
        agent.execute_job,
        job_id=str(job["id"]),
        organization_id=caller.organization_id,
        user_id=caller.sub,
        contract_id=body.contract_id,
    )
    return JobAccepted(job_id=str(job["id"]), status=job["status"])
