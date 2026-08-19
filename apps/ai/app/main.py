import logging

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.requests import Request

from .agents.bpo_qa.router import router as bpo_qa_router
from .agents.contract_audit.router import router as contract_audit_router
from .config import get_settings
from .routers import health, jobs

# Instantiated at import time so the process fails fast (raises
# pydantic.ValidationError) on incomplete configuration rather than starting
# and failing on the first request.
settings = get_settings()

# Never configured to log request/response bodies — prompts, transcripts,
# and model output must never reach application logs (brief: "no sensitive
# info in logs"). Only structured metadata (job ids, status, latency) is
# ever passed to `logger.*` calls throughout this service.
logging.basicConfig(level=settings.log_level.upper())

# No CORS middleware: this service is called server-to-server by apps/api
# only, never directly by a browser.
app = FastAPI(title="Nexa AI Orchestration Service", version="0.2.0")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    # FastAPI's default handler echoes back the invalid input value inside
    # each error entry, which for these endpoints could include transcript
    # or contract-id text — strip it down to loc/msg/type only.
    sanitized = [{"loc": e["loc"], "msg": e["msg"], "type": e["type"]} for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": sanitized})


app.include_router(health.router)
app.include_router(jobs.router)
app.include_router(contract_audit_router)
app.include_router(bpo_qa_router)
