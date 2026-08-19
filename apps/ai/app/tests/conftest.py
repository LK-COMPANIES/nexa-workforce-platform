"""Test configuration and shared fixtures for the AI orchestration service.

Environment note: this environment has no Python/pip installation, so these
tests are written carefully but have NOT been executed here (unlike the
TypeScript test suites in apps/api and packages/*, which were run via
`npx jest`). Run with `pip install -r requirements-dev.txt && pytest` in an
environment with Python available before relying on them as a merge gate.

None of these tests require a live Postgres or Redis instance — they mock
or fake the DB/Redis/Anthropic boundaries deliberately, since this
environment has neither running. What they do NOT verify is that
PostgreSQL's actual Row-Level Security policies (packages/database/prisma/
rls/*.sql) behave as described — that requires apps/api's own Prisma/RLS
integration tests (Phase 2/3) or a live database, and is out of scope here.
What they DO verify is the application-level contract every agent request
depends on: organization_id is taken exclusively from the verified JWT, and
a request referencing another tenant's contract_id is rejected — see
test_tenant_isolation.py.
"""

import os

os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")
os.environ.setdefault("JWT_ACCESS_SECRET", "test-secret-key-at-least-32-characters-long-ok")
os.environ.setdefault("AI_JWT_ISSUER", "nexa-test-issuer")
os.environ.setdefault("AI_JWT_AUDIENCE", "nexa-test-audience")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
os.environ.setdefault("AI_RATE_LIMIT", "1000/60")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")

import jwt as pyjwt
import pytest

from app.config import get_settings

ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
DEFAULT_USER_ID = "11111111-1111-1111-1111-111111111111"
DEFAULT_SESSION_ID = "22222222-2222-2222-2222-222222222222"


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def make_access_token(
    *,
    organization_id: str,
    user_id: str = DEFAULT_USER_ID,
    session_id: str = DEFAULT_SESSION_ID,
    role_key: str = "client_admin",
    token_type: str = "access",
    secret: str | None = None,
    issuer: str | None = None,
    audience: str | None = None,
    extra_claims: dict | None = None,
) -> str:
    settings = get_settings()
    claims = {
        "sub": user_id,
        "organization_id": organization_id,
        "session_id": session_id,
        "role_key": role_key,
        "token_type": token_type,
    }
    if extra_claims:
        claims.update(extra_claims)
    return pyjwt.encode(
        claims,
        secret or settings.jwt_access_secret,
        algorithm="HS256",
        issuer=issuer or settings.jwt_issuer,
        audience=audience or settings.jwt_audience,
    )
