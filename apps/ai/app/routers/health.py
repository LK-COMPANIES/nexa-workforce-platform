from datetime import datetime, timezone

from fastapi import APIRouter, Response, status

from ..db import get_pool

router = APIRouter()


# Liveness vs readiness (brief §15): liveness never touches a dependency —
# a Postgres outage must not make an orchestrator conclude this process
# itself is dead. Readiness checks Postgres (the only hard dependency this
# service has at request time) and deliberately never calls Anthropic —
# a health check must not spend API tokens on every probe.
@router.get("/health/live")
async def live() -> dict:
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/health/ready")
async def ready(response: Response) -> dict:
    database_up = True
    try:
        pool = await get_pool()
        async with pool.acquire() as connection:
            await connection.execute("SELECT 1")
    except Exception:
        database_up = False

    if not database_up:
        # A 200 with a "degraded" body is indistinguishable from healthy to
        # anything checking only the status code — fail the code too.
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "ok" if database_up else "degraded",
        "database": "up" if database_up else "down",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# Kept as an alias of readiness for backward compatibility with the
# pre-Phase-5 single /health endpoint (the dev docker-compose healthcheck).
@router.get("/health")
async def health(response: Response) -> dict:
    return await ready(response)
