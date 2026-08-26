# Production image for apps/web (Next.js). Multi-stage, turborepo-pruned,
# Next.js `standalone` output — see infrastructure/docker/web.dev.Dockerfile
# for the local-dev image; this file is never used for `docker compose up`
# in local development.
#
# Stage 1 (pruner):    turbo prune to the file set @nexa/web's build needs.
# Stage 2 (installer):  npm install + `turbo run build` (also builds
#                        @nexa/config/types/validation/payroll-engine, which
#                        apps/web imports as compiled packages — @nexa/ui is
#                        transpiled from source directly, no separate build).
#                        `next build`'s `output: "standalone"` (next.config.mjs)
#                        traces only the modules actually reachable at
#                        runtime into .next/standalone.
# Stage 3 (runner):     only .next/standalone + .next/static + public/ —
#                        standalone output does not include static assets or
#                        the public/ folder itself, both must be copied in
#                        explicitly per Next.js's own documented contract.
#                        Runs as non-root.
FROM node:20-bookworm-slim AS base
RUN corepack enable

# -----------------------------------------------------------------------------
FROM base AS pruner
WORKDIR /app
COPY . .
RUN npx turbo prune @nexa/web --docker

# -----------------------------------------------------------------------------
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN npm install
COPY --from=pruner /app/out/full/ .

# Build-time-only public config (brief §17: NEXT_PUBLIC_* is baked into the
# client bundle at build time, not read at container startup — a value
# supplied only via `docker run -e` after this stage would never reach the
# browser). Must be a real, reachable-from-the-browser origin at build time.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
# Present only so apps/web's env schema (packages/config) validates during
# `next build` — never read by the running standalone server, which talks
# to the API over the internal Docker network via API_INTERNAL_URL instead.
ENV API_INTERNAL_URL=http://api:4000

RUN npx turbo run build --filter=@nexa/web

# -----------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nexa && \
    useradd --system --uid 1001 --gid nexa --no-create-home nextjs

COPY --from=installer --chown=nextjs:nexa /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nexa /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer --chown=nextjs:nexa /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
