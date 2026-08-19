from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized, fail-fast environment configuration.

    Instantiating Settings() raises pydantic.ValidationError immediately if a
    required variable is missing or invalid — this service must never start
    with incomplete configuration. See packages/config/src/env.ts for the
    equivalent contract on the Node.js services.
    """

    model_config = SettingsConfigDict(extra="ignore", populate_by_name=True)

    environment: str = Field(default="development", alias="NODE_ENV")
    ai_port: int = Field(default=8000, alias="AI_PORT")

    # Connects as the same RLS-constrained `nexa_app` role the NestJS API
    # uses — this service gets no elevated database privileges either.
    database_url: str = Field(alias="DATABASE_URL")

    # Shared with apps/api so tokens issued by NestJS login can be verified
    # here without a network round-trip per request. Deliberately named
    # AI_JWT_ISSUER / AI_JWT_AUDIENCE (not reused from apps/api's own
    # JWT_ISSUER/JWT_AUDIENCE) so this boundary's expected values are
    # explicit and independently auditable, even though they must match
    # apps/api's issued tokens exactly to be accepted.
    jwt_access_secret: str = Field(alias="JWT_ACCESS_SECRET", min_length=32)
    jwt_issuer: str = Field(alias="AI_JWT_ISSUER")
    jwt_audience: str = Field(alias="AI_JWT_AUDIENCE")

    anthropic_api_key: str = Field(alias="ANTHROPIC_API_KEY")
    anthropic_model_contract_audit: str = Field(
        default="claude-sonnet-5", alias="ANTHROPIC_MODEL_CONTRACT_AUDIT"
    )
    anthropic_model_bpo_qa: str = Field(default="claude-sonnet-5", alias="ANTHROPIC_MODEL_BPO_QA")

    # Wall-clock budget for a single Anthropic call, in seconds. Enforced by
    # orchestration/client.py via asyncio.wait_for — a hung provider call
    # must not hang the job (and, via BackgroundTasks, the event loop) forever.
    ai_request_timeout: float = Field(default=45.0, alias="AI_REQUEST_TIMEOUT")

    # Hard ceiling, in UTF-8 bytes, on any single field of agent input text
    # (e.g. a BPO QA transcript). Rejected with 413 before it ever reaches
    # Claude — see middleware/request_size.py.
    ai_max_input_size: int = Field(default=50_000, alias="AI_MAX_INPUT_SIZE")

    # "<limit>/<window_seconds>", e.g. "20/60" = 20 requests per 60s per
    # organization. Parsed in middleware/rate_limit.py.
    ai_rate_limit: str = Field(default="20/60", alias="AI_RATE_LIMIT")

    redis_url: str = Field(default="redis://localhost:6379/1", alias="REDIS_URL")

    log_level: str = Field(default="info", alias="LOG_LEVEL")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
