from fastapi import FastAPI

from .config import get_settings
from .routers import health, orchestrate

# Instantiated at import time so the process fails fast (raises
# pydantic.ValidationError) on incomplete configuration rather than starting
# and failing on the first request.
get_settings()

# No CORS middleware: this service is called server-to-server by apps/api
# only, never directly by a browser.
app = FastAPI(title="Nexa AI Orchestration Service", version="0.1.0")

app.include_router(health.router)
app.include_router(orchestrate.router)
