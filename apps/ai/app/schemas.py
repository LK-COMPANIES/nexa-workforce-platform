from typing import Optional

from pydantic import BaseModel, Field


class OrchestrateRequest(BaseModel):
    organization_id: str
    requesting_user_id: Optional[str] = None
    agent_service: str = Field(min_length=1, max_length=100)
    request_type: str = Field(min_length=1, max_length=100)
    # Sent to the model but NEVER persisted verbatim — only a hash
    # (input_ref) is written to ai_audit_logs. See docs/architecture.md.
    prompt: str = Field(min_length=1)
    requires_human_review: bool = False


class OrchestrateResponse(BaseModel):
    audit_log_id: str
    status: str
    output_text: str
    output_ref: Optional[str]
    prompt_tokens: Optional[int]
    completion_tokens: Optional[int]
    latency_ms: int
