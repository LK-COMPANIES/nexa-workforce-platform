#!/usr/bin/env bash
# First-time local development bootstrap for Nexa Workforce Solutions.
#
# Order matters and mirrors the RLS bootstrapping constraints documented in
# packages/database/prisma/rls/001_enable_row_level_security.sql:
#   1. Datastores must be up before anything touches them.
#   2. The schema must exist (migrate) before RLS policies can be attached
#      to tables.
#   3. The `nexa_app` role (RLS-constrained) must exist (db:rls) before
#      apps/api or apps/ai — which connect AS that role via DATABASE_URL —
#      can start successfully.
#   4. Reference data (roles/permissions/jurisdiction/root org) must exist
#      before anyone can log in.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ ! -f .env ]; then
  echo "No .env found — copying .env.example. Edit it with real secrets before continuing." >&2
  cp .env.example .env
  exit 1
fi

echo "==> Installing dependencies"
npm install

echo "==> Starting Postgres and Redis"
docker compose up -d postgres redis

echo "==> Waiting for Postgres to report healthy"
until [ "$(docker compose ps -q postgres | xargs docker inspect -f '{{.State.Health.Status}}')" = "healthy" ]; do
  sleep 2
done

echo "==> Building internal packages (@nexa/database, config, types, auth, validation)"
npx turbo run build --filter='./packages/*'

echo "==> Applying Prisma migrations"
npm run db:migrate

echo "==> Applying Row-Level Security policies"
npm run db:rls

echo "==> Seeding system roles, permissions, and reference data"
npm run db:seed

echo "==> Bootstrap complete. Start the full stack with: docker compose up --build"
echo "    or run apps directly on the host with: npm run dev"
