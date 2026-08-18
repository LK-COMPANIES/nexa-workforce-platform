from datetime import datetime, timezone

from fastapi import APIRouter

from ..db import get_pool

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    database_up = True
    try:
        pool = await get_pool()
        async with pool.acquire() as connection:
            await connection.execute("SELECT 1")
    except Exception:
        database_up = False

    return {
        "status": "ok" if database_up else "degraded",
        "database": "up" if database_up else "down",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
