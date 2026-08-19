from typing import Optional

import redis.asyncio as redis
from fastapi import Depends, HTTPException, status

from ..auth import CallerClaims, verify_caller
from ..config import get_settings

_redis_client: Optional[redis.Redis] = None


def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        settings = get_settings()
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


def _parse_rate_limit(spec: str) -> tuple[int, int]:
    limit_str, window_str = spec.split("/")
    return int(limit_str), int(window_str)


async def enforce_rate_limit(caller: CallerClaims = Depends(verify_caller)) -> None:
    """Fixed-window rate limit keyed by organization_id (brief: "Rate
    limiting via Redis"). Applied per-organization rather than per-user so a
    single tenant cannot exhaust the AI service's Anthropic budget across
    all its users by spreading requests across accounts.

    Fails OPEN on Redis unavailability — an AI orchestration outage should
    degrade to "no rate limiting" rather than take down every agent
    endpoint, since Postgres RLS (not this check) is what actually protects
    tenant data; this is a cost/abuse control, not a security boundary.
    """
    settings = get_settings()
    limit, window_seconds = _parse_rate_limit(settings.ai_rate_limit)
    key = f"ai:rate_limit:{caller.organization_id}"

    try:
        client = get_redis()
        current = await client.incr(key)
        if current == 1:
            await client.expire(key, window_seconds)
    except redis.RedisError:
        return

    if current > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded: {limit} requests per {window_seconds}s per organization",
        )
