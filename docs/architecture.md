# Nexa Workforce Solutions — Architecture (Phase 1 + Phase 2 + Phase 3)

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
│   └── ai/                 FastAPI — AI orchestration + AIAuditLog governance
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
