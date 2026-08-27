# Production image for apps/website (the public marketing site — Nexa
# Workforce Solutions Ltd's company website). Deliberately independent of
# every other app: no @nexa/* workspace package dependency, no database,
# no auth — see apps/website/package.json. Sharing this monorepo's
# tooling/CI does not couple its code or data to the core platform.
#
# Stage 1 (pruner):    turbo prune to the file set @nexa/website's build needs.
# Stage 2 (installer):  npm install + `turbo run build` — standalone output.
# Stage 3 (runner):     only .next/standalone + .next/static + public/,
#                        non-root.
FROM node:20-bookworm-slim AS base
RUN corepack enable

# -----------------------------------------------------------------------------
FROM base AS pruner
WORKDIR /app
COPY . .
RUN npx turbo prune @nexa/website --docker

# -----------------------------------------------------------------------------
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN npm install
COPY --from=pruner /app/out/full/ .

# Optional — only affects generated canonical URLs (sitemap.ts, robots.ts,
# openGraph metadata); the site itself works without it.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

RUN npx turbo run build --filter=@nexa/website

# -----------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3100 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nexa && \
    useradd --system --uid 1001 --gid nexa --no-create-home nextjs

COPY --from=installer --chown=nextjs:nexa /app/apps/website/.next/standalone ./
COPY --from=installer --chown=nextjs:nexa /app/apps/website/.next/static ./apps/website/.next/static
COPY --from=installer --chown=nextjs:nexa /app/apps/website/public ./apps/website/public

USER nextjs
EXPOSE 3100

CMD ["node", "apps/website/server.js"]
