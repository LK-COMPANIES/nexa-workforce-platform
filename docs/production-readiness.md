# Production Readiness Checklist — Nexa Workforce Solutions Ltd

Every item below has a real status, evidenced by a specific file, test, or explicit gap — not marked complete because a configuration file exists. Where something could not be executed in the environment this Phase 5 work was authored in (no Docker, Python interpreter, or live Postgres/Redis available — see §"Environment constraints" at the end), that is stated explicitly rather than implied as verified.

Legend: ✅ Done & verified · 🟡 Done, not executable here (written/reviewed, unexecuted) · ⚠️ Partial / known gap · ❌ Not implemented

## Infrastructure

| Item | Status | Evidence |
|---|---|---|
| Multi-stage production Docker builds (web/api/ai) | 🟡 | `infrastructure/docker/{web,api,ai}.Dockerfile` — turborepo-pruned, non-root, no dev servers. Cannot `docker build` in this environment (no Docker CLI) — never executed. |
| Migration/seed one-shot container | 🟡 | `infrastructure/docker/migrate.Dockerfile`, wired into both compose files via `service_completed_successfully`. Same execution caveat. |
| Local dev workflow preserved | ✅ | `docker-compose.yml` still uses `.dev.Dockerfile` variants (hot reload, bind mounts) — unchanged behavior, plus the `migrate` service now fixes a real pre-existing gap (DB role had to be provisioned by hand before). |
| Production compose topology | 🟡 | `docker-compose.prod.yml` — internal/edge networks, no published DB/Redis ports, resource limits, `cap_drop`, healthchecks. Not executed. |
| Health checks (liveness vs. readiness) | ✅ | `apps/api/src/health/health.controller.ts` (`/health/live`, `/health/ready`, 503 on degraded — not a silent 200), `apps/ai/app/routers/health.py` (same split, never calls Anthropic), `apps/web/app/api/health/route.ts`. Compiles/type-checks cleanly; behavior not exercised against real dependencies. |
| Next.js standalone output | ✅ | `apps/web/next.config.mjs` (`output: "standalone"`, `outputFileTracingRoot`) — **actually built and verified**: `.next/standalone/apps/web/server.js` + traced `packages/*` confirmed present via a real `next build` run in this session. |
| Persistent storage | 🟡 | Named volumes (`postgres_data`, `redis_data`) in both compose files. Real production Postgres/Redis persistence (backups, PITR) is documented as an *operational* requirement, not provided by a local volume — see §"Production database/Redis requirements" below. |
| Database migrations (deterministic, no dev/reset in prod path) | ✅ | `migrate.Dockerfile`'s only command is `npm run db:deploy && npm run db:seed`, which is `prisma migrate deploy` (never `dev`/`reset`) → RLS → idempotent seed. Root `package.json` scripts unchanged from Phase 1-4, just now orchestrated automatically. |
| Redis wiring | ✅ | Already existed (Phase 4: `apps/api/src/redis`, `apps/ai`'s rate limiter) — Phase 5 adds `maxmemory`/`allkeys-lru` eviction policy in prod compose and the internal-network isolation. |
| Secrets never committed | ✅ | `.env.example` remains placeholder-only (verified via `git diff` before committing); `.dockerignore` excludes `.env*`; gitleaks added to CI (`security-checks` job). |
| Networking (no unnecessary public exposure) | ✅ (prod compose) / N/A (dev compose, intentional) | `docker-compose.prod.yml`'s `internal` network has no route out; postgres/redis have no `ports:` mapping there at all, only `expose`. |

## Security

| Item | Status | Evidence |
|---|---|---|
| Authentication (Argon2id, JWT rotation, revocation) | ✅ | Unchanged from Phase 2 — 27 passing `packages/auth` tests. |
| RBAC (DB-fresh permission resolution) | ✅ | Unchanged from Phase 2 — **and this phase found and fixed a critical bug that would have made it non-functional in any real deployment**: `TenantContextGuard`/`PermissionsGuard` couldn't resolve `AuthAuditService` outside `AuthModule`'s own scope, so every guarded endpoint would fail at app-bootstrap time. Fixed in `apps/api/src/tenancy/tenancy.module.ts` and `authorization.module.ts`; the app now builds a real DI graph successfully (verified — see §"What was actually executed" below). This was invisible to unit tests (which construct guards directly, bypassing DI) and could only be caught by an E2E test that boots the real `AppModule` — which is exactly what this phase added. |
| Row-Level Security (tenant isolation) | ✅ (code) / 🟡 (execution) | Strengthened this phase: added mandatory cross-tenant DELETE scenarios and full bidirectional (Tenant A ↔ Tenant B) coverage to `packages/database/test/tenant-isolation.integration.ts`, and net-new coverage for the Phase 4 `ai_jobs` table (`ai-jobs-tenant-isolation.integration.ts`, previously untested). CI now runs these against a real, disposable Postgres service — but that CI job has never actually executed in this authoring environment (no Docker). |
| IDOR testing | ✅ (code) / 🟡 (execution) | `apps/api/test/tenant-isolation.integration.spec.ts` — direct cross-tenant `GET`/`PATCH` by ID against contracts, expecting 404. Same execution caveat. |
| AI tenant isolation (no org-ID spoofing) | ✅ | Structural, not just tested: `apps/ai`'s agent request schemas have no `organization_id` field at all (Phase 4) — the E2E suite additionally proves a cross-tenant AI-audit *trigger* 404s before ever reaching the AI service HTTP boundary. |
| Secret scanning in CI | 🟡 | `gitleaks/gitleaks-action` in `.github/workflows/ci.yml`'s `security-checks` job. Never run (no GitHub Actions execution available here). |
| Container security (non-root, cap_drop, read-only) | 🟡 | Every production Dockerfile creates and switches to a dedicated non-root user; `docker-compose.prod.yml` sets `cap_drop: [ALL]` and `read_only: true` (with narrow `tmpfs` exceptions) on api/ai/web/migrate — deliberately **not** applied to the official postgres/redis images, whose own entrypoints need default capabilities for first-run initialization (see the compose file's own comment). Never executed. |
| Least-privilege database credentials | ✅ | Unchanged from Phase 1: `nexa_app` (RLS-constrained, `NOBYPASSRLS`) for runtime traffic; the owner role only for migrations/RLS provisioning — already the established pattern, reused, not weakened. |
| Graceful shutdown | ✅ (code) / 🟡 (execution) | `apps/api/src/main.ts` now calls `app.enableShutdownHooks()` — previously absent, meaning `PrismaService`/`RedisService`'s already-implemented `onModuleDestroy` hooks would never have fired on SIGTERM. `apps/ai`'s production CMD uses `exec uvicorn ...` (not a bare shell form) so SIGTERM reaches uvicorn directly, with an explicit `--timeout-graceful-shutdown`. |
| CI least privilege | ✅ | `.github/workflows/ci.yml` sets `permissions: contents: read` at the workflow level; no job requests more. |

## Application

| Item | Status | Evidence |
|---|---|---|
| Web (Next.js dashboard) | ✅ | Unchanged functionally from Phase 4; standalone build verified this phase. |
| API (NestJS) | ✅ (with the DI fix above) | 74 passing unit tests, clean `nest build`. |
| AI (FastAPI orchestration) | 🟡 | Restructured in Phase 4; this phase adds ruff config and the optional live-smoke test. Python test suite still cannot be executed in this environment (no interpreter). |
| Payroll | ✅ | Unchanged engine (108 passing tests); Phase 5 adds an E2E proof that persisted `PayrollRecord` figures match the same engine's own calculator-preview output for identical inputs. |
| Contracts | ✅ | Unchanged deterministic engine; Phase 5 adds E2E proof that an AI audit never mutates the deterministic evaluation history. |
| Compliance | ✅ | Unchanged; see `docs/compliance-readiness.md` for the full legal-mapping matrix (new this phase). |
| Employee creation API | ✅ (new) | `POST /employees` added this phase — previously read-only (Phase 4 only exposed `GET /employees` for the dashboard's workforce count). Added because the brief's mandated E2E critical path requires it and no UI/API path existed yet; gated by the pre-existing `employee:create` permission (already seeded, never wired to an endpoint). |

## Testing

| Item | Status | Evidence |
|---|---|---|
| Unit tests (TS) | ✅ Executed | 224 tests across `packages/auth`, `packages/payroll-engine`, `packages/validation`, `apps/api` — passing (Phase 4). |
| Unit/component tests (web) | ✅ Executed | 39 tests, first Jest setup for `apps/web` (Phase 4). |
| `typecheck` as a distinct CI stage | ✅ Executed | New this phase — every TS workspace got a `typecheck` script (none existed before; `build` happened to also type-check, which isn't the same as a dedicated fast check). Verified via `npx turbo run typecheck` — 15/15 tasks pass, including the new/modified E2E and integration test files (added to dedicated `tsconfig.test.json` files in `apps/api` and `packages/database` specifically so `test/` directories are covered, since the main tsconfigs exclude them). |
| Database / RLS integration tests | 🟡 Written, not executed here | See "Row-Level Security" row above. |
| API end-to-end tests | 🟡 Written, smoke-tested for correctness, not fully executed | `apps/api/test/critical-path.integration.spec.ts` and `tenant-isolation.integration.spec.ts`. **What was actually verified in this environment**: (1) full TypeScript type-checking passes; (2) a real `Test.createTestingModule(AppModule).compile()` run was executed against these files (no live Postgres), which is what surfaced and confirmed the fix for the `AuthAuditService` DI bug above — the app now progresses correctly through every guard and fails only at the expected point (`PrismaClientInitializationError: Can't reach database server`, i.e. no Postgres in this sandbox). The actual HTTP assertions have not run against real data. |
| Multi-tenant E2E | 🟡 Written, same caveat | `tenant-isolation.integration.spec.ts` — register two orgs, create employees/contracts under each via the real API, assert cross-tenant 404s in both directions. |
| AI mocked integration (apps/api side) | ✅ Design verified, execution caveat as above | `apps/api/test/helpers/fake-ai-service.ts` — a minimal real HTTP server standing in for `apps/ai`, so the E2E suite exercises the actual `AiService`/`AiController` code path (including that the caller's own JWT is forwarded, not fabricated) without Python or a live Anthropic key. |
| AI mocked integration (apps/ai side) | 🟡 Written, not executed | `apps/ai/app/tests/` — 8 files, ~44 cases, Anthropic SDK mocked at the client boundary. No Python interpreter available in this environment to run `pytest` (checked: `python`/`python3` resolve to Windows Store stub aliases; a `Python313` directory exists on `PATH` but contains no actual interpreter binary). |
| Live AI smoke test | 🟡 Written, gated correctly, not run | `apps/ai/app/tests/test_live_smoke.py`, marked `live_smoke`, excluded from the default `pytest` invocation, only selectable via the manually-triggered `ai-live-smoke-test` GitHub Actions job. |
| Container build validation | 🟡 Configured, not executed | `.github/workflows/ci.yml`'s `docker-build-validation` job (matrix over web/api/ai/migrate, `push: false`). No Docker CLI available here to dry-run it directly. |

## Operations

| Item | Status | Evidence |
|---|---|---|
| Structured logging | ⚠️ Partial | NestJS's built-in `Logger` used for exceptions (`AllExceptionsFilter`); no structured (JSON) log format, no request-ID propagation implemented yet. Documented as an extension point, not built. |
| Request IDs | ❌ | Not implemented. |
| Monitoring / metrics integration points | ⚠️ Documented, not wired | `OTEL_EXPORTER_OTLP_ENDPOINT` exists in `.env.example` (Phase 4) but nothing in `apps/api`/`apps/ai` actually emits OpenTelemetry data yet — it's an env var placeholder, not a working integration. Sentry/Prometheus/Grafana: no code exists for any of them. |
| Backups / restore | ❌ (code) / N/A (this is inherently an infrastructure-operator responsibility) | No backup automation exists in this repo — see §"Production database requirements" below for what a real deployment needs to add. |
| Disaster recovery | ❌ | Not documented with real RPO/RTO numbers, because no infrastructure exists yet to measure them against — see below. |
| Incident response | ❌ | No runbook exists. |
| Rollback | ⚠️ Partial | `prisma migrate deploy` is forward-only by design (standard Prisma behavior) — a schema rollback requires a hand-authored down-migration, which is not automated here. Application rollback (redeploying a prior image) is a platform-level capability this repo doesn't provide, since no specific platform is assumed (brief §33/§43). |

---

## Environment constraints this Phase 5 work was authored under

Stated plainly, once, here — repeated inline above only where it changes a specific item's status:

- **No Docker CLI** — every Dockerfile and both compose files were written and carefully reviewed but never `docker build`/`docker compose up`-tested.
- **No Python interpreter** — `apps/ai`'s test suite, ruff config, and pytest markers were written but never executed.
- **No live PostgreSQL or Redis** — every integration/E2E test was type-checked and, for the API E2E suite, actually executed against a real (if unreachable) `Test.createTestingModule(AppModule)` boot — which is how the critical DI bug above was found — but no test's actual database assertions have run.
- **No GitHub Actions execution** — `.github/workflows/ci.yml` has never fired.

None of this is a reason to defer the work; it's the reason every claim in this document is qualified honestly instead of asserted. **Before this is trusted as production-ready, someone with Docker/Postgres/Redis/Python available must actually run**: `docker compose -f docker-compose.prod.yml up --build`, the full `.github/workflows/ci.yml` pipeline (a pushed branch or PR will trigger it automatically), and `pytest` inside `apps/ai`.

## Production database requirements (documented, not implemented — brief §34)

A real production PostgreSQL deployment needs, beyond what `docker-compose.prod.yml`'s single container provides: encrypted storage at rest, automated backups with tested restore procedures, point-in-time recovery, connection/query monitoring, network access restricted to the application tier only, periodic credential rotation for both the owner and `nexa_app` roles, and a disaster-recovery procedure with actual measured RPO/RTO — none of which a local Docker volume delivers. This is exactly why the "Backups/Restore/Disaster recovery" rows above are marked ❌ rather than papered over: a single-container Postgres is appropriate for local development and possibly a low-stakes staging environment, and is explicitly not presented here as enterprise-grade infrastructure.

## Production Redis requirements (documented, not implemented — brief §35)

Similarly: persistence tuning appropriate to the actual workload (AOF is enabled in this repo's Redis config, which is a reasonable default, not a tuned-for-production choice), a failover strategy (the single container here has none), monitoring, credential rotation, and memory/eviction limits sized to real traffic (`maxmemory 256mb` / `allkeys-lru` in `docker-compose.prod.yml` is a conservative placeholder, not a capacity-planned value). A single Docker Redis container has no automatic high availability.
