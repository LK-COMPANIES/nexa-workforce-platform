# Development image for apps/web (Next.js). See api.Dockerfile for the
# rationale on installing the full workspace and deferring a hermetic
# production build to Phase 2.
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

EXPOSE 3000

# Routed through turbo so the "dev" task's `dependsOn: ["^build"]`
# (turbo.json) builds internal package dependencies first — see api.Dockerfile.
CMD ["npx", "turbo", "run", "dev", "--filter=@nexa/web"]
