from fastapi import HTTPException, Request, status

from ..config import get_settings


async def enforce_max_body_size(request: Request) -> None:
    """Rejects oversized agent payloads before the body is ever parsed or
    forwarded to Claude (brief security-audit item: "oversized AI
    payloads"). Trusts Content-Length as a fast-path guard only — this is a
    cost/DoS control, not the sole enforcement; a client that lies about
    Content-Length and streams an oversized body is still bounded by
    uvicorn's own request size handling upstream of this service.
    """
    settings = get_settings()
    content_length = request.headers.get("content-length")
    if content_length is not None and int(content_length) > settings.ai_max_input_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Request body exceeds the {settings.ai_max_input_size}-byte limit for AI agent requests",
        )
