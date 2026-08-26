# Production image for apps/api (NestJS). Multi-stage, turborepo-pruned —
# see infrastructure/docker/api.dev.Dockerfile for the local-dev image
# (bind-mounted source, hot reload); this file is never used for `docker
# compose up` in local development.
#
# Stage 1 (pruner):   turbo prune to the minimal file set @nexa/api's build
#                      actually needs — excludes @nexa/web and every package
#                      apps/api doesn't depend on.
# Stage 2 (installer): npm install against the pruned lockfile/package.json
#                      set (cacheable), then `turbo run build` (compiles
#                      @nexa/database, @nexa/config, @nexa/types, @nexa/auth,
#                      @nexa/validation, @nexa/payroll-engine, then
#                      @nexa/api — `prisma generate` runs as part of
#                      @nexa/database's own build script), then
#                      `npm prune --omit=dev` strips devDependencies from
#                      node_modules IN PLACE — preserving the already-
#                      generated Prisma client, which lives inside
#                      node_modules/@prisma/client and would otherwise be
#                      lost by a fresh production-only install.
# Stage 3 (runner):    only the pruned node_modules + compiled dist/
#                      output, running as a non-root user.
FROM node:20-bookworm-slim AS base
RUN corepack enable

# -----------------------------------------------------------------------------
FROM base AS pruner
WORKDIR /app
COPY . .
RUN npx turbo prune @nexa/api --docker

# -----------------------------------------------------------------------------
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN npm install
COPY --from=pruner /app/out/full/ .
RUN npx turbo run build --filter=@nexa/api
RUN npm prune --omit=dev

# -----------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd --system --gid 1001 nexa && \
    useradd --system --uid 1001 --gid nexa --no-create-home nestjs

COPY --from=installer --chown=nestjs:nexa /app .

USER nestjs
EXPOSE 4000

# NestJS's PrismaService/RedisService onModuleDestroy hooks only fire when
# the process actually receives SIGTERM directly — `node` as PID 1 handles
# this correctly on its own (no exec-form shell wrapping needed here, unlike
# a shell CMD, which would swallow the signal). See main.ts's
# app.enableShutdownHooks() call for the other half of graceful shutdown.
CMD ["node", "apps/api/dist/main.js"]
