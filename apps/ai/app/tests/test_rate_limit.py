import pytest
from fastapi import HTTPException

from app.auth.jwt import verify_caller
from app.config import get_settings
from app.middleware.rate_limit import enforce_rate_limit

from .conftest import ORG_A, ORG_B, make_access_token


class _FakeRedis:
    def __init__(self):
        self.store: dict[str, int] = {}
        self.raise_on_incr: Exception | None = None

    async def incr(self, key: str) -> int:
        if self.raise_on_incr:
            raise self.raise_on_incr
        self.store[key] = self.store.get(key, 0) + 1
        return self.store[key]

    async def expire(self, key: str, seconds: int) -> bool:
        return True


async def _caller(organization_id: str):
    token = make_access_token(organization_id=organization_id)
    return verify_caller(authorization=f"Bearer {token}")


async def test_enforce_rate_limit_allows_requests_under_the_limit(monkeypatch):
    monkeypatch.setenv("AI_RATE_LIMIT", "2/60")
    get_settings.cache_clear()

    fake_redis = _FakeRedis()
    monkeypatch.setattr("app.middleware.rate_limit.get_redis", lambda: fake_redis)

    caller = await _caller(ORG_A)
    await enforce_rate_limit(caller=caller)
    await enforce_rate_limit(caller=caller)  # 2nd request, still within limit


async def test_enforce_rate_limit_rejects_after_limit_exceeded(monkeypatch):
    monkeypatch.setenv("AI_RATE_LIMIT", "2/60")
    get_settings.cache_clear()

    fake_redis = _FakeRedis()
    monkeypatch.setattr("app.middleware.rate_limit.get_redis", lambda: fake_redis)

    caller = await _caller(ORG_A)
    await enforce_rate_limit(caller=caller)
    await enforce_rate_limit(caller=caller)
    with pytest.raises(HTTPException) as exc_info:
        await enforce_rate_limit(caller=caller)
    assert exc_info.value.status_code == 429


async def test_enforce_rate_limit_is_scoped_per_organization(monkeypatch):
    monkeypatch.setenv("AI_RATE_LIMIT", "1/60")
    get_settings.cache_clear()

    fake_redis = _FakeRedis()
    monkeypatch.setattr("app.middleware.rate_limit.get_redis", lambda: fake_redis)

    caller_a = await _caller(ORG_A)
    caller_b = await _caller(ORG_B)

    await enforce_rate_limit(caller=caller_a)  # org A's 1st and only allowed request
    await enforce_rate_limit(caller=caller_b)  # org B has its own independent budget

    with pytest.raises(HTTPException):
        await enforce_rate_limit(caller=caller_a)


async def test_enforce_rate_limit_fails_open_when_redis_unavailable(monkeypatch):
    import redis as redis_module

    monkeypatch.setenv("AI_RATE_LIMIT", "1/60")
    get_settings.cache_clear()

    fake_redis = _FakeRedis()
    fake_redis.raise_on_incr = redis_module.RedisError("connection refused")
    monkeypatch.setattr("app.middleware.rate_limit.get_redis", lambda: fake_redis)

    caller = await _caller(ORG_A)
    # Should not raise even though the configured limit is 1 and this is
    # called twice — a Redis outage must not become an outage of the AI
    # service itself (see rate_limit.py's docstring on failing open).
    await enforce_rate_limit(caller=caller)
    await enforce_rate_limit(caller=caller)
