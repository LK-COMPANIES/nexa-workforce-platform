# Production image for apps/ai (FastAPI). Multi-stage — see
# infrastructure/docker/ai.dev.Dockerfile for the local-dev image
# (--reload against bind-mounted source); this file is never used for
# `docker compose up` in local development.
#
# Stage 1 (builder): compiles/installs into an isolated virtualenv so no
#                     build tooling (a C compiler would only be needed if a
#                     dependency lacked a prebuilt wheel for this platform —
#                     none currently do, but the venv keeps that risk
#                     contained regardless) ends up in the runtime image.
# Stage 2 (runner):   copies only the venv + application code, runs as a
#                      non-root user, no --reload, a production ASGI
#                      server with configurable worker count.
FROM python:3.12-slim AS base

FROM base AS builder
WORKDIR /build
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY apps/ai/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

FROM base AS runner
WORKDIR /app
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN groupadd --system --gid 1001 nexa && \
    useradd --system --uid 1001 --gid nexa --no-create-home aiuser

COPY --from=builder /opt/venv /opt/venv
COPY --chown=aiuser:nexa apps/ai/app ./app

USER aiuser
EXPOSE 8000

# Liveness only (no DB dependency) — orchestrators should point their
# actual readiness probe at GET /health/ready via docker-compose's own
# healthcheck (which can express "unhealthy", unlike this fallback).
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health/live', timeout=2).status==200 else 1)" || exit 1

# `exec` replaces the shell with uvicorn as PID 1, so SIGTERM reaches it
# directly (a bare shell-form CMD without exec would swallow the signal in
# the shell instead of forwarding it) — this is what makes uvicorn's own
# graceful shutdown (finish in-flight requests, then exit) actually work.
# AI_WORKERS defaults to 2: enough for real concurrency without assuming
# a specific host's CPU count, since the async orchestration work here is
# I/O-bound (Postgres, Redis, the Anthropic API) rather than CPU-bound.
# --timeout-graceful-shutdown gives an in-flight Claude call (bounded by
# AI_REQUEST_TIMEOUT) room to finish rather than being killed mid-request.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${AI_WORKERS:-2} --timeout-graceful-shutdown ${AI_GRACEFUL_SHUTDOWN_TIMEOUT:-60}"]
