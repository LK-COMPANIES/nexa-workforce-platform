import pytest
from fastapi import HTTPException, Request

from app.config import get_settings
from app.middleware.request_size import enforce_max_body_size


def _make_request(content_length: str | None) -> Request:
    headers = [(b"content-length", content_length.encode())] if content_length is not None else []
    scope = {"type": "http", "headers": headers, "method": "POST", "path": "/agents/contract-audit"}
    return Request(scope)


async def test_enforce_max_body_size_rejects_oversized_payload(monkeypatch):
    monkeypatch.setenv("AI_MAX_INPUT_SIZE", "100")
    get_settings.cache_clear()

    request = _make_request("1000")
    with pytest.raises(HTTPException) as exc_info:
        await enforce_max_body_size(request)
    assert exc_info.value.status_code == 413


async def test_enforce_max_body_size_allows_payload_within_limit(monkeypatch):
    monkeypatch.setenv("AI_MAX_INPUT_SIZE", "100")
    get_settings.cache_clear()

    request = _make_request("50")
    await enforce_max_body_size(request)  # should not raise


async def test_enforce_max_body_size_allows_missing_content_length_header():
    request = _make_request(None)
    await enforce_max_body_size(request)  # should not raise; not the sole enforcement layer
