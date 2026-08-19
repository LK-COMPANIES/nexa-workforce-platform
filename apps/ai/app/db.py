import json
import re
from contextlib import asynccontextmanager
from typing import Optional

import asyncpg

from .config import get_settings

_UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)

_pool: Optional[asyncpg.Pool] = None


async def _init_connection(connection: asyncpg.Connection) -> None:
    # asyncpg returns json/jsonb columns as raw text by default. Registering
    # this codec on every pooled connection means every jsonb column (ai_jobs
    # .result_json, compliance_evaluations.findings, contracts.terms, etc.)
    # comes back as an already-parsed Python object everywhere in this
    # service, matching how Prisma behaves for apps/api.
    await connection.set_type_codec(
        "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog", format="text"
    )
    await connection.set_type_codec(
        "json", encoder=json.dumps, decoder=json.loads, schema="pg_catalog", format="text"
    )


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = await asyncpg.create_pool(dsn=settings.database_url, init=_init_connection)
    return _pool


def _assert_uuid(value: str, label: str) -> None:
    if not _UUID_PATTERN.match(value):
        raise ValueError(f"{label} must be a valid UUID, received: {value!r}")


@asynccontextmanager
async def tenant_transaction(tenant_id: str, user_id: Optional[str] = None):
    """Python counterpart of packages/database/src/tenant-context.ts
    runWithTenant() — the only sanctioned way this service touches
    tenant-scoped tables. Sets the same Postgres RLS session GUCs inside a
    transaction so prisma/rls/001_enable_row_level_security.sql policies
    apply identically regardless of which service is connecting.
    """
    _assert_uuid(tenant_id, "tenant_id")
    if user_id:
        _assert_uuid(user_id, "user_id")

    pool = await get_pool()
    async with pool.acquire() as connection:
        async with connection.transaction():
            # Values are validated as UUIDs above (not attacker-controlled
            # free text) before interpolation — Postgres's SET command does
            # not accept bind parameters, matching the Node implementation.
            await connection.execute(f"SET LOCAL app.current_tenant_id = '{tenant_id}'")
            if user_id:
                await connection.execute(f"SET LOCAL app.current_user_id = '{user_id}'")
            yield connection
