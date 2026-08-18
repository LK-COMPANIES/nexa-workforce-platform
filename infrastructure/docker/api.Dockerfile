# Development image for apps/api (NestJS). Installs the full npm workspace
# so symlinks between packages/* and apps/api resolve correctly, then runs
# the dev server with hot reload against the bind-mounted source (see
# docker-compose.yml). A hermetic, multi-stage production build (turbo
# prune + no bind mounts) is an explicit Phase 2 item — see docs/architecture.md.
FROM node:20-bookworm-slim

WORKDIR /workspace

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/validation/package.json packages/validation/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN npm install

COPY . .

EXPOSE 4000

# Routed through turbo (not `npm run dev --workspace=...`) so the "dev"
# task's `dependsOn: ["^build"]` (turbo.json) builds @nexa/database,
# @nexa/config, @nexa/types, @nexa/auth, @nexa/validation to dist/ first —
# apps/api requires their compiled output, it cannot `require()` raw .ts.
CMD ["npx", "turbo", "run", "dev", "--filter=@nexa/api"]
