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
    # here without a network round-trip per request.
    jwt_access_secret: str = Field(alias="JWT_ACCESS_SECRET", min_length=32)
    jwt_issuer: str = Field(alias="JWT_ISSUER")
    jwt_audience: str = Field(alias="JWT_AUDIENCE")

    anthropic_api_key: str = Field(alias="ANTHROPIC_API_KEY")
    anthropic_model: str = Field(default="claude-sonnet-5", alias="ANTHROPIC_MODEL")

    log_level: str = Field(default="info", alias="LOG_LEVEL")


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
