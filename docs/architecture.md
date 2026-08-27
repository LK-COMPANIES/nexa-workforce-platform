# Nexa Workforce Solutions — Architecture (Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5)

## 1. Repository layout

```
nexa-workforce-platform/
├── apps/
│   ├── web/               Next.js 14 (App Router) — primary user-facing surface
│   ├── api/                NestJS — auth, authorization, tenancy, orgs, payroll, contracts
│   │   └── src/
│   │       ├── auth/         authentication: login/register/refresh/logout/revoke/me,
│   │       │                 sessions, refresh-token rotation, Argon2id, audit events
│   │       ├── authorization/ RBAC: PermissionsGuard, @RequirePermission
│   │       ├── tenancy/       TenantContextGuard — the per-request RLS/membership boundary
│   │       ├── payroll/       run lifecycle, bulk calculation, statutory rule loading, reporting
│   │       ├── contracts/     contract CRUD + compliance/ (deterministic Employment Act validator)
│   │       ├── organizations/ thin proof-of-pattern endpoint
│   │       └── prisma/, redis/, config/, health/, common/
│   ├── ai/                 FastAPI — AI orchestration + AIAuditLog governance
│   └── website/            Next.js 14 — PUBLIC marketing site (nexaworkforce
│                            sells-the-company site). Deliberately independent
│                            of every other app: no @nexa/* package dependency,
│                            no database, no auth. Shares this monorepo's
│                            tooling only — not the platform's code or data.
├── packages/
│   ├── database/            Prisma schema, migrations, RLS SQL, seed, tenant-context wrapper
│   ├── config/               Fail-fast environment validation (zod)
│   ├── types/                 Shared enums/types — no DB dependency
│   ├── auth/                  RBAC matrix, Argon2id password hashing + policy,
│   │                          JWT issuance/verification, refresh-token primitives
│   ├── validation/             Shared zod input schemas (incl. statutory rule shapes)
│   └── ui/                     Minimal shared UI primitives — web-only
├── infrastructure/docker/     Dockerfiles for api/web/ai
├── scripts/                    bootstrap-dev.sh — first-time local setup
├── docs/                       this file
├── docker-compose.yml
├── .env.example
├── turbo.json
└── package.json
```

## 2. Tenant isolation model

Every tenant-scoped table (`organizations`, `organization_memberships`,
`employees`, `contracts`, `payroll_records`, `ai_audit_logs`, `sessions`,
`refresh_tokens`, `authentication_audit_events`) carries an explicit
`organization_id` column (`refresh_tokens` derives it from its parent
`sessions` row instead — see §5), **and** is protected by PostgreSQL Row-
Level Security, **and** is only ever queried through `runWithTenant()`
(Node: `packages/database/src/tenant-context.ts`; Python: `apps/ai/app/db.py`'s
`tenant_transaction`).

This is deliberately three layers, not one:

1. **Application-level filtering** (`organizationId` in every query) — the
   convenience layer, easy to get wrong.
2. **Database-level RLS** (`packages/database/prisma/rls/*.sql`) — the real
   security boundary. A query issued without tenant context set returns zero
   rows / rejects zero-affecting writes, because
   `current_setting('app.current_tenant_id', true)` is `NULL` when unset,
   and `organization_id = NULL` is never true in SQL. **Fails closed.**
3. **A single sanctioned code path** (`runWithTenant`) that is the only
   place `SET LOCAL app.current_tenant_id` is issued.

The `nexa_app` database role has `NOBYPASSRLS` — RLS applies to it
unconditionally, on every table, including the Phase 2 auth tables. Only the
migration/owner role (`DIRECT_DATABASE_URL`) can create schema or alter
policies, and it is never used by the running application.

## 3. Request pipeline (Phase 2)

```
HTTP Request
  → JwtAuthGuard          verifies access-token signature/exp/iss/aud — identity only,
  |                       no DB hit. Token carries NO permissions array by design.
  → TenantContextGuard    re-derives authorization from the database, live, on every
  |                       request: session ACTIVE + unexpired + matches claimed
  |                       (user, org) → user ACTIVE → active OrganizationMembership
  |                       (or platform-super-admin) → current permissions from that
  |                       membership's role. Runs inside runWithTenant(), so Postgres
  |                       RLS itself is the backstop if this logic ever has a bug.
  → PermissionsGuard      checks @RequirePermission(...) against the DB-fresh
  |                       permissions TenantContextGuard just resolved.
  → Handler               opens its OWN runWithTenant() transaction(s) for its work.
  → Postgres RLS          independent, final enforcement layer.
```

A JWT's `organization_id`/`role_key` claims are never trusted for
authorization by themselves — only as *inputs* to the live DB check above.
See `apps/api/src/tenancy/tenant-context.guard.ts`.

### The authentication bootstrapping exception

Two operations must read data before any tenant context can exist:

- **Login** — reading a `users` row by email. Handled by the
  `auth_lookup_user_by_email` `SECURITY DEFINER` SQL function (Phase 1),
  which returns only the columns a login flow needs.
- **Refresh** — resolving an opaque refresh token to its session/user/org.
  Handled by the equivalent `auth_lookup_refresh_token` `SECURITY DEFINER`
  function (Phase 2, `prisma/rls/002_phase2_sessions_and_auth_audit.sql`).

Every other access to `users`, `sessions`, or `refresh_tokens` goes through
the normal RLS-constrained path once tenant context is established.

## 4. Authentication architecture

- **Access token**: short-lived JWT (`JWT_ACCESS_TTL`, default 15m). Claims:
  `sub`, `organization_id`, `session_id`, `role_key`, `token_type`, plus
  registered `iat`/`exp`/`iss`/`aud`. No permissions, no personal data.
- **Refresh token**: long-lived (`JWT_REFRESH_TTL`, default 7d), opaque
  256-bit random value. Only its SHA-256 hash is stored
  (`RefreshToken.tokenHash`) — a fast hash is correct here because the token
  itself carries the entropy, unlike a password. Tokens are grouped into
  rotation **families** (`familyId`): every refresh retires the presented
  token (`status: ROTATED`) and issues a new one in the same family. A
  token whose status is anything other than `ACTIVE` being presented again
  is treated as theft — the whole family and its `Session` are revoked
  (`status: REUSE_DETECTED` / `REVOKED`), forcing fresh authentication. See
  `apps/api/src/auth/auth.service.ts#refresh`.
- **Sessions**: one `Session` row per (user, organization) login. Logout and
  admin-initiated revocation (`POST /auth/revoke`, gated by `user:disable`)
  invalidate the session and all its refresh tokens; the access token
  remains technically valid until its own short expiry, but
  `TenantContextGuard` checks live session status on every request, so a
  revoked session stops working immediately in practice, not just at next
  refresh.
- **Passwords**: Argon2id (`packages/auth/src/password.ts`), OWASP-baseline
  parameters. Policy (`password-policy.ts`) is length-based (≥12 chars) plus
  a denylist, per NIST SP 800-63B rather than composition rules.
- **Audit**: every login success/failure, logout, refresh, reuse-detection,
  session revocation, and registration writes an `AuthenticationAuditEvent`
  row (`apps/api/src/auth/auth-audit.service.ts`) — never a password or raw
  token, only structured metadata.

### Registration = client-organization onboarding

`POST /auth/register` does not create a bare user. It atomically creates a
new `CLIENT` `Organization`, its first `User`, and a `client_admin`
`OrganizationMembership` — that role is hard-coded in `AuthService.register`,
never accepted from the request body, so public registration cannot produce
`nexa_super_admin` or any other privileged role.

## 5. RBAC model

`User → OrganizationMembership → Role → Permission`, exactly as Phase 1
established — membership, not the user, is the authorization boundary,
because a user may hold different roles in different organizations. System
roles (`packages/types/src/roles.ts`): `nexa_super_admin`, `client_admin`,
`hr_manager`, `bpo_supervisor` (kept beyond this brief's 5-role minimum),
`bpo_agent`, `employee`. Permission grants
(`packages/auth/src/role-permissions.ts`) are least-privilege by design —
e.g. `hr_manager` can `payroll:process` but not `payroll:approve`
(separation of duties); `employee` gets zero RBAC permissions (self-record
access is a resource-ownership check, not a role grant).

### Platform super-admin

`User.isPlatformSuperAdmin` lets a login skip the `OrganizationMembership`
requirement for a target organization (`AuthService.login`), granting the
full `nexa_super_admin` permission set for that session
(`Session.isSuperAdminSession = true`). Critically, this is an
**application-layer** authorization decision — the database connection is
still `nexa_app` (`NOBYPASSRLS`), still goes through the identical
`runWithTenant()`/RLS path, and still only ever sees ONE organization per
request. There is no database-level bypass anywhere in the system. Every
such session is audited (`SUPER_ADMIN_ORG_ACCESS`), and
`TenantContextGuard` re-checks `user.isPlatformSuperAdmin` on every request
(not just at login), so revoking the flag takes effect immediately.

## 6. Statutory reference data — provenance and confidence

`StatutoryRuleVersion` now versions independently **per instrument**
(`ruleType`: `PAYE` | `NSSF` | `SHIF` | `HOUSING_LEVY`), because they change
on unrelated schedules — NSSF's tiers stepped up in February 2026 while
PAYE's bands did not move.

The seeded 2026 Kenya figures (`packages/database/prisma/seed.ts`) were
established via web research during this phase's authorship, cross-checked
across multiple independent, mutually-consistent secondary sources (payroll/
HR calculator and law-firm sites). KRA's own public notice page returned a
**stale, pre-2023 band table** when fetched directly and could not be used
as primary citation; a specific 2026 NSSF gazette notice number could not be
located. Every seeded row's `sourceReference` documents exactly what was
checked and flags this explicitly. **This is not a substitute for legal/
compliance sign-off** — verify against a primary KRA/NSSF/SHA/Gazette
document before this data drives a real payroll run.

## 7. Service communication

Unchanged from Phase 1, with one addition: `apps/api` forwards the caller's
own access token to `apps/ai`, which now verifies `issuer`/`audience` too
(`apps/ai/app/dependencies.py`) and no longer trusts a permissions claim —
it trusts identity only, matching the Phase 2 principle that authorization
is re-derived from the database, not carried in a token.

## 8. Environment configuration

Extends Phase 1's `packages/config` fail-fast pattern with: `JWT_ISSUER`,
`JWT_AUDIENCE` (required), and `AUTH_BOOTSTRAP_ENABLED` /
`NEXA_BOOTSTRAP_ADMIN_EMAIL` / `NEXA_BOOTSTRAP_ADMIN_PASSWORD` (used only by
the seed script, via `loadBootstrapAdminConfig()` — conditionally required
only when bootstrap is enabled; the password has no default). See
`.env.example`.

## 9. First-time setup

```bash
cp .env.example .env   # then fill in real secrets
npm install
docker compose up -d postgres redis
npx turbo run build --filter='./packages/*'   # compiles shared packages to dist/
npm run db:migrate                             # applies packages/database/prisma/migrations/
npm run db:rls                                 # provisions nexa_app role + RLS policies (both .sql files)
npm run db:seed                                # roles/permissions, KE 2026 statutory data,
                                                # engagement types, root org, (optional) bootstrap admin
docker compose up --build                      # or: npm run dev
```

To create the initial platform super-admin, set `AUTH_BOOTSTRAP_ENABLED=true`
plus `NEXA_BOOTSTRAP_ADMIN_EMAIL`/`NEXA_BOOTSTRAP_ADMIN_PASSWORD` in `.env`
before running `db:seed`, then unset `AUTH_BOOTSTRAP_ENABLED`. Re-running the
seed never overwrites an existing account's password.

## 10. Testing

- `packages/auth` (`npm test --workspace=@nexa/auth`): 27 unit tests,
  genuinely executed — Argon2id hash/verify round-trip, password policy,
  JWT sign/verify including forgery/expiry/wrong-issuer/wrong-audience
  rejection, refresh-token generation, and least-privilege assertions on the
  role→permission matrix.
- `apps/api` (`npm test --workspace=@nexa/api`): 30 unit tests, genuinely
  executed — `JwtAuthGuard`, `PermissionsGuard`, and (the most
  security-critical) `TenantContextGuard` against a mocked Prisma
  transaction covering every reject path (revoked/expired session, disabled
  account, no active membership, super-admin flag revoked after issuance)
  and the success path proving stale JWT claims are discarded in favor of
  DB-fresh values; `AuthService` login (uniform failure messages across all
  failure reasons) and refresh (rotation, reuse detection on both `ROTATED`
  and `REVOKED` tokens, expiry).
- `packages/database/test/tenant-isolation.integration.ts`
  (`npm run test:integration --workspace=@nexa/database`): the
  brief-mandated live-RLS proof — Tenant A cannot read, list, or update
  Tenant B's rows; a query with no tenant context set returns zero rows.
  **Not executed in this environment** (no Docker/Postgres available here —
  confirmed via `docker --version` failing) — it type-checks cleanly and is
  written to run against a real database via
  `docker compose up -d postgres && npm run db:migrate && npm run db:rls`.
  This is the most important remaining verification step before Phase 3.

## 11. Intentionally deferred

- **Full CRUD APIs** for employees/contracts/payroll — foundation +
  auth/authz only.
- **Cross-tenant admin UI/API surface** for `nexa_super_admin` (listing all
  organizations, etc.) — the login/session mechanism supports it; no
  endpoints exist yet.
- **Organizational hierarchy visibility in RLS** — a parent org still can't
  see its children's rows through RLS (exact `id = current_tenant_id` only).
- **Hermetic production Docker images** — current Dockerfiles are dev-loop.
- **Redis-backed distributed rate limiting** — `ThrottlerModule` (Phase 1)
  is in-memory per-process; a Redis storage adapter is the documented
  extension point for multi-instance deployment, not yet wired.
- **Object storage integration**, **password-change endpoint** (the
  `PASSWORD_CHANGED` audit event type is defined, unused).

## 12. Architectural risks to resolve before Phase 3

1. **The tenant-isolation integration test has not been executed against a
   real database in this environment.** Run it in CI or locally with Docker
   before trusting RLS enforcement in production — see §10.
2. **Statutory data needs legal/compliance sign-off** — see §6. Treat every
   `sourceReference` caveat as a blocking TODO, not a formality.
3. **`nexa_app`'s and the bootstrap admin's credentials are provisioned
   imperatively** from `.env` — production needs real secrets management
   (rotation, not a flat file).
4. **No distributed rate limiting yet** — a multi-instance deployment of
   `apps/api` today gets independent per-process throttling, not a shared
   limit; brute-force protection on `/auth/login` is weaker than it looks
   under horizontal scaling until the Redis adapter is wired in.

## 13. Phase 3 — payroll engine, contracts, compliance

### Payroll engine boundary

`packages/payroll-engine` has exactly one runtime dependency (`decimal.js`)
and no import of `@nestjs/*`, `@prisma/client`, or anything network/DB/env-
shaped — enforced by its own `package.json`, not just convention. It is
called from `apps/api/src/payroll/payroll-calculation.service.ts`, the sole
adapter translating Employee/Contract rows and DB-stored statutory rule JSON
into the engine's plain `KenyaPayrollRules` input, and translating
`PayrollCalculationResult` back into `PayrollRecord` columns.

**Money**: every monetary value is a `Decimal` internally; `number` is used
only at the input/output boundary. **Rounding policy**: each statutory line
item (PAYE, each NSSF tier, SHIF, Housing Levy) is rounded to 2dp exactly
once, immediately after being computed, and every aggregate (totals, net
pay) is built by summing those already-rounded values — this was a real bug
caught by the engine's own test suite (summing full-precision internals and
rounding once at the end let a displayed total disagree by a cent from its
own printed line items) and is now fixed with a regression test locking in
the behavior. See `packages/payroll-engine/src/money.ts` for the full
policy.

### Payroll run lifecycle and atomicity

`PayrollRun` owns the lifecycle (`DRAFT → CALCULATING → CALCULATED →
[UNDER_REVIEW] → APPROVED → FINALIZED`, or `VOIDED`/`FAILED`), enforced by a
pure state-machine (`payroll-run-lifecycle.ts`) — `FINALIZED` has zero
outgoing transitions, so a finalized run can never be recalculated or voided
(a correction requires a new `CORRECTION`-type run). Idempotency (brief §21)
is a real Postgres unique constraint
(`organizationId, payrollPeriodStart, payrollPeriodEnd, runType`), not just
application logic — a duplicate `POST /payroll/runs` gets a 409, not a
silent double-run.

`PayrollService.calculate()` runs the ENTIRE bulk calculation for an
organization inside one Postgres transaction: either every employee's
`PayrollRecord` is written and the run reaches `CALCULATED`, or nothing is
(rolled back) and a *separate* transaction marks the run `FAILED` — brief
§18's "complete successfully, or fail safely and preserve prior state,"
never a partially-saved run reported as successful. Documented scaling
boundary: this trades unbounded scale for atomicity-for-free, which is the
right call at the organization sizes this foundation targets; past a large
employee count, a single transaction stops being viable and the next
evolution is a chunked saga/outbox pattern — not built here (see comments in
`payroll.service.ts`).

### Statutory rule pinning

`PayrollRunStatutoryRule` pins the exact `StatutoryRuleVersion` used for
each of PAYE/NSSF/SHIF/Housing Levy at calculation time. This corrects a
real Phase 1 gap: `PayrollRecord` originally had a single
`statutoryRuleVersionId`, but one calculation genuinely depends on four
independently-versioned instruments. Since Phase 1/2 never had a live
deployment, this was fixed via a proper migration rather than worked around
— see the migration's own header comment for the one constraint this
implies (the migration requires `payroll_records` to be empty, true for
every real environment).

### Contract compliance

`apps/api/src/contracts/compliance/compliance-validator.ts` is a pure,
deterministic function — no LLM/AI reasoning for statutory arithmetic (brief
§33) — that validates a contract against `ComplianceRuleVersion` rows
(Section 9/10 particulars, Section 42(2) probation limits, Section 35
notice minimums, Section 37 casual-conversion threshold), all versioned
data, never constants in code. Findings are `PASS` / `WARNING` / `FAIL` /
`REQUIRES_HUMAN_REVIEW` — notably, `OUTSOURCED_WORKFORCE` contracts always
resolve to `REQUIRES_HUMAN_REVIEW` rather than a fabricated pass, because
determining the true employer-of-record (Nexa vs. the operational client)
isn't something the current data model can verify automatically (brief
§30's employer-of-record distinction is flagged, not silently assumed).
Every evaluation is a new, append-only `ComplianceEvaluation` row — brief
§34: "compliance history is evidence," never overwritten.

**Legal provenance**: the five Employment Act rules seeded
(`packages/database/prisma/seed.ts`) were researched via a plain-text
extraction of Act No. 11 of 2007 cross-checked against independent legal
summaries (research performed 2026-08-18) — **not verified against the
primary Kenya Law Reports text directly**. Treat any `FAIL` this validator
produces as a strong signal requiring human legal review, not an
automatic rejection, until that verification happens.

### What changed in this phase's audit

- **Rounding-composition bug** (above) — found by the engine's own test
  suite, fixed, regression-tested.
- **Duplicate-payroll-run 500 instead of 409** — `PayrollRepository.createRun`
  claimed a Prisma unique-constraint violation would surface as a 409, but
  the global exception filter only special-cases `HttpException`; a raw
  Prisma error fell through to a generic 500. Fixed by catching `P2002`
  explicitly and raising `ConflictException`, with a regression test.

## 14. Architectural risks to resolve before Phase 4

1. **The Phase 3 tenant-isolation integration test has not been executed
   against a real database in this environment** (no Docker/Postgres
   available here) — run it before trusting RLS on `payroll_runs`,
   `contracts`, and `compliance_evaluations` in production.
2. **Employment Act rules need primary-source legal verification** — see
   §13. A `FAIL` finding should route to human review, not an automatic
   contract rejection, until this happens.
3. **Per-employee benefits, deductions, and tax residency are not yet
   modeled** — the payroll engine fully supports non-cash benefits,
   classified allowable deductions, and residency status; `Employee`/
   `Contract` just don't have the fields to source them from yet. This is a
   real, scoped gap, not a hidden one.
4. **Single-transaction bulk calculation does not scale indefinitely** — see
   §13's documented scaling boundary.
5. **No document-rendering layer** for `Contract.terms` (the
   `ContractDocumentModel`) — PDF/DOCX generation was explicitly out of
   scope (brief §31: the compliance engine must not be coupled to a
   renderer).

## 15. Phase 4 — multi-tenant web dashboard & AI orchestration

### Frontend architecture (`apps/web`)

Next.js 14 App Router, Server Components by default. Two httpOnly cookies
(`nexa_access_token`, `nexa_refresh_token`) are the entire browser-visible
auth surface — set/read/cleared exclusively in server code
(`lib/auth/cookies.ts`, `lib/api/server-fetch.ts`); no token, permission
array, or Anthropic credential is ever sent to client JavaScript.
`middleware.ts` does proactive silent refresh (Server Components cannot
mutate cookies mid-render, so by the time one renders its cookies are
already fresh) and coarse route protection; **this is a UX optimization,
not the security boundary** — every backend call independently re-verifies
the token regardless (brief §6).

All backend calls funnel through one function, `apiFetch()`
(`lib/api/server-fetch.ts`) — no scattered `fetch()` calls (brief §21) —
which attaches the access token, retries once through silent refresh on
401, and throws a typed `ApiError` subclass (401/403/404/409/422/429/5xx)
that `ApiErrorCard` renders distinctly per page. Mutations are Server
Actions (`"use server"`); `useFormState`/`useFormStatus` from `react-dom`
(not `useActionState` from `react` — this project is on React 18.3, not
19). `packages/ui` is a hand-written shadcn-pattern component library
(Radix primitives + CVA + `tailwind-merge`), not the shadcn CLI, since that
requires network registry access this environment doesn't have.

**Tenant switching**: `GET /auth/memberships` returns only the caller's own
authorized memberships; `OrgSwitcher` can only submit an `organizationId`
sourced from that list — never a free-typed UUID (brief §12). The backend
(`AuthService.switchOrganization`) independently re-validates: a platform
super-admin may switch into any existing organization (audited as
`SUPER_ADMIN_ORG_ACCESS`), everyone else needs a live `ACTIVE`
`OrganizationMembership` row, checked fresh at switch time — not cached
from login. On success, `switchOrganizationDirect` redirects to
`/dashboard` (a full navigation, not an in-place revalidation), which is
what actually prevents stale previous-tenant data from lingering in any
Server Component's render tree.

**No fabricated dashboard metrics** (brief §8): `/dashboard`'s 9-division
intelligence grid and "Active BPO Seats" render `NoOperationalData` because
no backend data source exists for them yet — same principle applied
project-wide (`organizations` page has no admin/invite flow yet because
that would need a new RLS-bypass pattern not yet designed; it says so
rather than faking it).

### AI orchestration service (`apps/ai`)

Restructured from a single-file FastAPI app into
`auth/ · middleware/ · orchestration/ · schemas/ · services/ · agents/{contract_audit,bpo_qa}/`.
Two agents, both following the same shape:

1. **`create_job()`** (synchronous, fast): resolves the request's
   `contract_id` inside `tenant_transaction(caller.organization_id, ...)`
   and creates a `PENDING` `AiJob` row. **`organization_id` is never a field
   on any agent request schema** (`ContractAuditRequest`, `BpoQaRequest`) —
   the caller's JWT is the *only* source of tenant scope this service ever
   consults. A `contract_id` belonging to another tenant is invisible to
   the RLS-scoped query, full stop — there is no `organization_id`
   comparison to get wrong, because there is no comparison at all.
2. **`execute_job()`** (async, backgrounded): scheduled via FastAPI
   `BackgroundTasks` so the 202 response returns immediately and the Claude
   call never blocks the HTTP request. Calls Claude with a forced tool-use
   turn (`tool_choice={"type":"tool",...}`) whose `input_schema` is the
   agent's own Pydantic model's JSON schema, then re-validates the model's
   tool input against that same Pydantic model before it is ever persisted
   — the "strict Pydantic-schema-validated Claude outputs" requirement.
   Every attempt, success or failure, writes exactly one `AIAuditLog` row
   (hashed input/output refs only, never raw text — reusing the existing
   Phase 1 governance table) and updates the `AiJob` row's terminal state
   in the same transaction.

**Contract audit** output uses a deliberately different severity
vocabulary (`INFO`/`ADVISORY`/`CONCERN`) from the deterministic engine's
`PASS`/`WARNING`/`FAIL`/`REQUIRES_HUMAN_REVIEW`, carries a fixed disclaimer
field, and its system prompt is explicitly instructed not to re-derive or
contradict the deterministic result it's given as read-only context — the
"AI-generated legal analysis must be clearly distinguished from
deterministic compliance results" requirement (brief §20), enforced at the
schema and prompt level, not just the UI. `ContractAiAuditPanel.tsx` on the
frontend reinforces this with distinct styling (violet accent, "Sparkles"
icon, an "AI-generated" badge on every render path) — never sharing a
component with `ComplianceFindingsPanel`.

**BPO QA** evaluates a real, user-submitted interaction transcript against
a contract's service terms — it never fabricates call/interaction data,
and is only offered for `OUTSOURCED_WORKFORCE`/`CLIENT_SERVICES_AGREEMENT`
contracts (checked server-side, not just hidden in the UI). Its backend
agent and tests exist; **no frontend screen consumes it yet** — Task
scope for this phase was the contract-audit UI panel specifically (brief
§24's frontend/AI integration item), so BPO QA is complete and tested at
the API boundary but not yet wired into a page. Documented gap, not a
hidden one.

**Prompt versioning**: each agent's system/user prompt lives in
`orchestration/prompts/{agent}_v1.py` with an explicit `PROMPT_VERSION`
string, persisted on every `AiJob` row. Changing prompt wording requires
bumping that string — there is no other way to change it in production.

**Rate limiting**: Redis, fixed-window, keyed by `organization_id` (not
per-user, so one tenant can't spread requests across accounts to bypass
it). **Fails open** on Redis unavailability — a deliberate choice, since
this is a cost/abuse control, not a security boundary (RLS is); documented
in `middleware/rate_limit.py`'s own docstring and covered by a test that
asserts the fail-open behavior explicitly, not just the fail-closed path.

**Oversized-payload guard**: `middleware/request_size.py` rejects a
request with `Content-Length` over `AI_MAX_INPUT_SIZE` (default 50 KB)
with 413, before the body is parsed or reaches Claude — a fast-path cost
control, not the sole enforcement (a client lying about `Content-Length`
is still bounded upstream by uvicorn's own request handling).

**No sensitive logging**: neither service logs prompt text, transcript
content, model output, or the bearer token anywhere — `apps/ai`'s
`logging.basicConfig` call and its own top-of-file comment in `main.py`
make this an explicit constraint, not an accident; `apps/api`'s new `ai/`
module has no logging calls at all.

### The NestJS boundary (`apps/api/src/ai`)

`AiService`/`AiController` proxy `POST /contracts/:id/ai-audit` and
`GET /ai/jobs/:jobId` to `apps/ai`, forwarding the **same** access token
`JwtAuthGuard` just verified for the incoming request (stashed on
`request.rawAccessToken`, read via a new `@CurrentAccessToken()`
decorator) — deliberately not minting a second, parallel credential.
`apps/ai` re-verifies that token independently and derives
`organization_id` from it itself; apps/api forwarding it is a convenience,
never a trust shortcut apps/ai relies on. The Anthropic API key exists
nowhere in `apps/api` or `apps/web` — only in `apps/ai`'s own environment.

### What changed in this phase's audit

- **A malformed-but-correctly-signed JWT payload (missing a required
  claim) in `apps/ai`'s `verify_caller`** would have raised an unhandled
  `pydantic.ValidationError`, surfacing as a 500 rather than a 401 —
  caught during test-writing, fixed by catching `ValidationError`
  explicitly and converting it to the same 401 every other auth failure
  produces. Regression-tested.
- **asyncpg does not auto-decode `jsonb` columns** — without a registered
  type codec, `AiJob.result_json` (and every other jsonb column this
  service touches) would come back as a raw JSON *string*, silently
  breaking `JobStatusResponse`'s Pydantic validation the first time a real
  row was read. Fixed by registering `json`/`jsonb` codecs on every pooled
  connection in `db.py`, matching how Prisma already behaves for
  `apps/api` — caught by design review before it ever shipped, since no
  live Postgres was available here to catch it by running the code.
- **Radix `Select`'s `name` prop already renders an internal hidden native
  `<select>`** for form association; an earlier draft of
  `CreateRunDialog.tsx` (Phase 4 payroll work) added a *second*, manual
  hidden input with the same `name`, which would have caused
  `formData.get()` to silently return whichever value came first in DOM
  order regardless of the user's actual selection. Removed before it
  shipped.
- **Tenant-switching authorization had zero test coverage** before this
  phase, despite being one of the highest-consequence code paths in the
  system (`AuthService.switchOrganization`, unchanged since Phase 2). Six
  new tests now cover: valid membership switch, no membership, inactive
  user, and the platform-super-admin bypass (both the allowed and the
  target-organization-does-not-exist cases).

### Verification performed vs. not performed this phase

Executed and passing: 224 TypeScript tests across `packages/auth`,
`packages/payroll-engine`, `packages/validation` (new), and `apps/api`
(`npx jest`), plus 39 new `apps/web` tests (`npx jest`, first Jest setup
for this app — `next/jest` + `jest-environment-jsdom` +
`@testing-library/react`) covering the API error hierarchy, permission
gating, `ApiErrorCard`'s branch logic, payroll lifecycle button-visibility
gating, and `middleware.ts`'s route-protection/refresh decisions via a
real `NextRequest`. Every `apps/web` and `apps/api` page/route touched this
phase was also verified via a clean, fully type-checked `next build` /
`nest build`.

**Not executed**: `apps/ai`'s entire Python test suite (7 files, ~40 cases,
including the mandatory "Tenant A JWT + Tenant B request body → REJECT"
test) — this environment has no Python interpreter at all (confirmed: only
an empty, binary-less `Python313` directory on `PATH`). The suite was
written carefully, mocks the Postgres/Redis/Anthropic boundaries
deliberately rather than requiring live infrastructure, and is documented
in its own `conftest.py` docstring as unexecuted — run
`pip install -r requirements-dev.txt && pytest` before trusting it. This
mirrors the same honesty pattern applied to the Phase 3 RLS integration
tests (§14, item 1): written, reasoned about carefully, not proof of
correctness until actually run.

No live browser walkthrough of login → dashboard → org-switch → contract
audit was possible in this environment either, for the same reason
Phase 1–3 couldn't: no Docker/Postgres/Redis here to actually run the
stack end-to-end. Everything above is build/type/unit-test verified, not
manually clicked through.

## 16. Architectural risks to resolve before Phase 5

1. **`apps/ai`'s test suite has never been executed** — see §15. Run it in
   a real environment before trusting the tenant-isolation guarantees it
   asserts, same caveat as the Phase 3 RLS integration tests (item 2
   below) — neither has ever actually touched a live Postgres in this
   environment.
2. **The Phase 3 RLS integration test still has not been executed against
   a real database** (carried over from §14 — still unresolved; Phase 4
   added `ai_jobs` to the same RLS-protected table set via
   `005_phase4_ai_jobs.sql`, following the exact pattern of
   `001`–`004`, but it inherits the same "written, not run" caveat).
3. **`apps/ai`'s async job execution uses FastAPI `BackgroundTasks`**, not
   a distributed task queue — genuinely async (never blocks the HTTP
   response, runs concurrently on the same event loop), but in-process and
   single-instance. Fine at current scale; horizontally scaling `apps/ai`
   to multiple replicas would need a real queue (Celery/RQ) with Redis or
   similar as the broker, not a rewrite of the agent logic itself.
4. **BPO QA has no frontend screen** — see §15. The agent, its tests, and
   the NestJS proxy pattern all exist; only the UI consuming it is
   missing.
5. **No admin-driven organization onboarding/invite flow** — `/organizations`
   shows the caller's own org and members only; adding a new member or
   creating a second organization under a super-admin has no UI or
   endpoint yet. Deliberately deferred rather than half-built (brief's own
   "no fabricated data / no fake states" principle applied to feature
   completeness, not just numbers).
6. **Employment Act rules still need primary-source legal verification** —
   carried over from §14, unchanged this phase.
7. **Per-employee benefits, deductions, and tax residency are still not
   modeled** on `Employee`/`Contract` — carried over from §14, unchanged.
8. **No document-rendering layer** — carried over from §14, unchanged.

## 17. Phase 5 — production readiness, deployment, CI/CD, end-to-end integration

Full detail lives in two new dedicated documents rather than duplicated here: [`docs/production-readiness.md`](production-readiness.md) (infrastructure/security/application/testing/operations checklist, every item with a real status) and [`docs/compliance-readiness.md`](compliance-readiness.md) (Employment Act 2007, Data Protection Act 2019, and statutory payroll matrices — an engineering readiness document, not legal advice or certification).

### What Phase 5 added

- **Production Docker**: multi-stage, non-root `infrastructure/docker/{web,api,ai,migrate}.Dockerfile`, turborepo-pruned for web/api/migrate, a virtualenv-isolated build for ai. The pre-existing dev-oriented Dockerfiles were renamed to `*.dev.Dockerfile`, not replaced — local `docker compose up` behavior is unchanged. `docker-compose.prod.yml` is new: internal/edge network separation (Postgres/Redis never on a network with external routing, never given a `ports:` mapping), `cap_drop`, `read_only` root filesystems with narrow `tmpfs` exceptions, resource limits, and a one-shot `migrate` service (`prisma migrate deploy` → RLS → seed) gated via `service_completed_successfully` — the same `migrate` service was also added to the dev compose file, fixing a real pre-existing gap where the `nexa_app` role had to be provisioned by hand on first run.
- **CI**: `.github/workflows/ci.yml` — lint, typecheck (new `typecheck` script added to every TS workspace; none existed before), unit tests, a real disposable-Postgres RLS-validation job, a real disposable-Postgres-plus-Redis API end-to-end job, an independent Python/ruff/pytest job, a build job, a container-build-validation matrix (build-only, never pushes), gitleaks secret scanning, and an optional manually-triggered live-Anthropic smoke test that never runs on ordinary PRs.
- **RLS tests strengthened**: added mandatory cross-tenant DELETE scenarios and full bidirectional (Tenant A ↔ Tenant B, not just A→B) coverage to the existing Phase 2/3 integration scripts, plus net-new coverage for the Phase 4 `ai_jobs` table (previously untested). The scripts' "skip if no DB" behavior now becomes a hard failure when `CI=true` — a misconfigured CI environment can no longer silently report a passing suite that never ran.
- **API end-to-end tests** (new): `apps/api/test/{critical-path,tenant-isolation}.integration.spec.ts` boot the real `AppModule` via `Test.createTestingModule` and drive it with `supertest` — register → login → RBAC → employee → contract → deterministic compliance → payroll (verified against the same engine's own calculator-preview output, not re-derived math) → AI audit (against a minimal fake HTTP stand-in for `apps/ai`, proving the real `apps/api`↔`apps/ai` contract without needing Python or a live Anthropic key) → audit log, plus the mandatory two-tenant IDOR/spoofing scenario.
- **`POST /employees` added** — previously read-only (Phase 4 exposed only `GET /employees` for the dashboard). Added because the E2E critical path requires it and no UI/API path existed yet; the validation schema and `employee:create` permission already existed, unused, since an earlier phase.

### A critical bug found by this phase's own E2E tests

Booting the real Nest DI container (`Test.createTestingModule({ imports: [AppModule] }).compile()`) — which nothing in Phases 1–4 had ever actually done, since every prior test constructed guards directly with `new TenantContextGuard(mockPrisma, mockAuditService)`, bypassing Nest's DI system — immediately failed with `Nest can't resolve dependencies of the TenantContextGuard (PrismaService, ?)`. Root cause: `@UseGuards(TenantContextGuard)` / `@UseGuards(PermissionsGuard)` are resolved by Nest within the DI scope of whichever module declares the controller using them, not just wherever the guard happens to be provided elsewhere — and neither `TenancyModule` nor `AuthorizationModule` re-exported `AuthAuditModule` (only the guard itself), so `AuthAuditService` was invisible to every feature module (`OrganizationsModule`, `ContractsModule`, `EmployeesModule`, `PayrollModule`, `AiModule`) except `AuthModule`, which happened to import `AuthAuditModule` directly for its own reasons. **In practice this meant the entire API would have failed to even start in any real deployment** — not a silent security bypass (DI resolution fails at bootstrap, before the process ever listens on a port), but a total, immediate, unmissable failure that unit tests structurally could not catch and that this environment's lack of a live database had prevented from surfacing for four phases. Fixed by adding `AuthAuditModule` to both modules' `exports` arrays; verified by re-running the same DI boot, which now progresses correctly through every guard and fails only at the expected, unrelated point (no live Postgres in this authoring environment).

### Environment constraints (stated once, in full, in `docs/production-readiness.md`)

No Docker CLI, no Python interpreter, no live Postgres/Redis, and no GitHub Actions execution were available while authoring this phase. Every claim above that depends on one of those is marked accordingly in `docs/production-readiness.md` rather than asserted as verified — the one exception is the DI bug above, which a real (if ultimately DB-less) Nest boot in this environment did directly prove and disprove.

## 18. Architectural risks to resolve before Phase 6

1. **None of Phase 5's Docker/CI infrastructure has ever executed** — see §17's environment-constraints note. This is the single highest-priority item: run `docker compose -f docker-compose.prod.yml up --build`, push a branch to trigger `.github/workflows/ci.yml`, and run `pytest` inside `apps/ai`, before trusting any of it.
2. **`apps/ai`'s test suite and the Phase 2/3/5 RLS integration tests have still never executed** — carried over, now compounding across three phases of "written, not run."
3. **No structured logging, request-ID propagation, or wired-up monitoring/error-tracking** — `.env.example`'s `OTEL_EXPORTER_OTLP_ENDPOINT` is a placeholder, not a working integration. See `docs/production-readiness.md`'s Operations section.
4. **No backup/restore/disaster-recovery automation exists** — by design, not oversight: no specific production infrastructure is assumed yet (brief §33), so there is nothing concrete to automate against. This becomes real work once a deployment target is chosen.
5. **No data-subject rights (access/correction/erasure) API, no retention/deletion policy, and the controller/processor determination for DPA 2019 purposes is unresolved** — see `docs/compliance-readiness.md` §2. These are legal/product gaps, not infrastructure gaps, and the highest-risk item in that document (cross-border data transfer to Anthropic) needs legal sign-off specifically, not more code.
6. **BPO QA still has no frontend screen** — carried over from §16.
7. **No admin-driven organization onboarding/invite flow** — carried over from §16.
8. **Employment Act rules and all four statutory payroll rates still need primary-source legal verification** — carried over from §14/§16, now with a full matrix in `docs/compliance-readiness.md` making the specific gaps explicit rather than a general caveat.
9. **Per-employee benefits, deductions, and tax residency are still not modeled**; **no document-rendering layer exists** — both carried over unchanged.
