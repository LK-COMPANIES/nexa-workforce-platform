import time

import jwt as pyjwt
import pytest
from fastapi import HTTPException

from app.auth.jwt import verify_caller
from app.config import get_settings

from .conftest import DEFAULT_SESSION_ID, DEFAULT_USER_ID, ORG_A, make_access_token


def test_verify_caller_accepts_valid_access_token():
    token = make_access_token(organization_id=ORG_A)
    claims = verify_caller(authorization=f"Bearer {token}")
    assert claims.organization_id == ORG_A
    assert claims.sub == DEFAULT_USER_ID
    assert claims.token_type == "access"


def test_verify_caller_rejects_missing_header():
    with pytest.raises(HTTPException) as exc_info:
        verify_caller(authorization=None)
    assert exc_info.value.status_code == 401


def test_verify_caller_rejects_non_bearer_scheme():
    with pytest.raises(HTTPException) as exc_info:
        verify_caller(authorization="Basic abcdef")
    assert exc_info.value.status_code == 401


def test_verify_caller_rejects_wrong_issuer():
    token = make_access_token(organization_id=ORG_A, issuer="someone-elses-issuer")
    with pytest.raises(HTTPException) as exc_info:
        verify_caller(authorization=f"Bearer {token}")
    assert exc_info.value.status_code == 401


def test_verify_caller_rejects_wrong_audience():
    token = make_access_token(organization_id=ORG_A, audience="someone-elses-audience")
    with pytest.raises(HTTPException) as exc_info:
        verify_caller(authorization=f"Bearer {token}")
    assert exc_info.value.status_code == 401


def test_verify_caller_rejects_wrong_signing_secret():
    token = make_access_token(
        organization_id=ORG_A, secret="a-completely-different-secret-value-32-chars-long"
    )
    with pytest.raises(HTTPException) as exc_info:
        verify_caller(authorization=f"Bearer {token}")
    assert exc_info.value.status_code == 401


def test_verify_caller_rejects_refresh_token_type():
    token = make_access_token(organization_id=ORG_A, token_type="refresh")
    with pytest.raises(HTTPException) as exc_info:
        verify_caller(authorization=f"Bearer {token}")
    assert exc_info.value.status_code == 401


def test_verify_caller_rejects_expired_token():
    settings = get_settings()
    # iss/aud are payload claims for pyjwt.encode(), not keyword arguments
    # (only decode() takes issuer=/audience= — see conftest.py's
    # make_access_token comment, fixed after actually running this suite).
    token = pyjwt.encode(
        {
            "sub": DEFAULT_USER_ID,
            "organization_id": ORG_A,
            "session_id": DEFAULT_SESSION_ID,
            "role_key": "client_admin",
            "token_type": "access",
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
            "exp": int(time.time()) - 60,
        },
        settings.jwt_access_secret,
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc_info:
        verify_caller(authorization=f"Bearer {token}")
    assert exc_info.value.status_code == 401


def test_verify_caller_rejects_token_missing_required_claim():
    settings = get_settings()
    # No organization_id claim at all — CallerClaims(**payload) must fail
    # pydantic validation rather than default organization_id to something.
    token = pyjwt.encode(
        {
            "sub": DEFAULT_USER_ID,
            "session_id": DEFAULT_SESSION_ID,
            "role_key": "x",
            "token_type": "access",
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
        },
        settings.jwt_access_secret,
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc_info:
        verify_caller(authorization=f"Bearer {token}")
    assert exc_info.value.status_code == 401
