from typing import Annotated, Optional

import jwt
from fastapi import Header, HTTPException, status
from pydantic import BaseModel, ValidationError

from ..config import get_settings


class CallerClaims(BaseModel):
    """Mirrors AccessTokenClaims in packages/auth/src/jwt.ts. Deliberately
    carries NO permissions — apps/api resolves and revalidates authorization
    per-request against the database (see apps/api's TenantContextGuard) and
    forwards only the caller's proven identity; this service trusts identity,
    not a permissions list that could go stale in transit. This service
    trusts tokens issued by apps/api's login flow — it never issues its own,
    and is never called directly by a browser (no CORS is configured here).

    organization_id here is the SOLE source of tenant scope for every agent
    request this service handles. No agent request schema in app/schemas
    accepts an organization_id field from the caller — see
    services/contract_repository.py for why that is the actual enforcement
    mechanism, not just a convention.
    """

    sub: str
    organization_id: str
    session_id: str
    role_key: str
    token_type: str


def verify_caller(authorization: Annotated[Optional[str], Header()] = None) -> CallerClaims:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = authorization.removeprefix("Bearer ")
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_access_secret,
            algorithms=["HS256"],
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        ) from exc

    try:
        claims = CallerClaims(**payload)
    except ValidationError as exc:
        # A syntactically valid, correctly-signed JWT that is nonetheless
        # missing a required claim (e.g. organization_id) is still an
        # authentication failure, not a server error — must not surface as
        # an unhandled 500.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token payload missing required claims"
        ) from exc

    if claims.token_type != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not an access token")
    return claims
