from datetime import datetime
from typing import Optional, Union

from pydantic import BaseModel

from .bpo_qa import BpoQaResult
from .contract_audit import ContractAuditResult


class JobAccepted(BaseModel):
    job_id: str
    status: str


class JobStatusResponse(BaseModel):
    job_id: str
    agent_type: str
    status: str
    prompt_version: str
    result: Optional[Union[ContractAuditResult, BpoQaResult]] = None
    error: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
