# One-shot deployment container: applies Prisma migrations, provisions/
# re-applies RLS policies, then seeds idempotent reference data — the
# authoritative implementation of the startup sequence documented in
# docs/architecture.md and enforced by docker-compose.prod.yml via
# `depends_on: migrate: condition: service_completed_successfully`.
# Never runs `prisma migrate dev` or `prisma migrate reset` — see
# packages/database's own package.json scripts, reused verbatim below
# rather than reinvented here.
#
# This container is expected to run to completion and exit; it is not a
# long-lived service (no CMD loop, no healthcheck — compose's
# `service_completed_successfully` condition IS the readiness signal for
# every service that depends on it).
FROM node:20-bookworm-slim AS base
RUN corepack enable

FROM base AS pruner
WORKDIR /app
COPY . .
RUN npx turbo prune @nexa/database --docker

FROM base AS runner
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN npm install
COPY --from=pruner /app/out/full/ .

# db:deploy already chains `prisma migrate deploy` -> `db:rls` (root
# package.json) — see docs/architecture.md's deployment sequence. db:seed
# runs only after both succeed; `&&` means any failed step aborts the
# chain and the container exits non-zero, which is what makes
# `service_completed_successfully` correctly refuse to start api/ai on a
# failed migration instead of racing ahead.
CMD ["sh", "-c", "npm run db:deploy && npm run db:seed"]
