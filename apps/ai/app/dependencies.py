from typing import Annotated, Optional

import jwt
from fastapi import Header, HTTPException, status
from pydantic import BaseModel

from .config import get_settings


class CallerClaims(BaseModel):
    """Mirrors AccessTokenClaims in packages/auth/src/jwt.ts. Deliberately
    carries NO permissions — apps/api resolves and revalidates authorization
    per-request against the database (see apps/api's TenantContextGuard) and
    forwards only the caller's proven identity; this service trusts identity,
    not a permissions list that could go stale in transit. This service
    trusts tokens issued by apps/api's login flow — it never issues its own,
    and is never called directly by a browser (no CORS is configured here).
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

    claims = CallerClaims(**payload)
    if claims.token_type != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not an access token")
    return claims
