# Multi-stage Dockerfile for diligence-kit-service.
# Build context: monorepo root (the workflow passes context=. and file=apps/service/Dockerfile).
# This Dockerfile expects pnpm-lock.yaml + pnpm-workspace.yaml at the build context root.

# ---- Base ----
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ---- Deps (only the manifest files for cacheable installs) ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/service/package.json ./apps/service/
RUN pnpm install --frozen-lockfile --filter diligence-kit-service...

# ---- Build (compile + prisma generate) ----
FROM deps AS build
COPY apps/service ./apps/service
RUN pnpm --filter diligence-kit-service exec prisma generate
RUN pnpm --filter diligence-kit-service build

# ---- Dev target (used by docker-compose / local) ----
FROM build AS dev
WORKDIR /repo/apps/service
EXPOSE 3001
CMD ["pnpm", "start:dev"]

# ---- Prod target (default) ----
FROM base AS prod
COPY --from=build /repo /repo
WORKDIR /repo/apps/service
RUN chmod +x entrypoint.sh
EXPOSE 3001
CMD ["./entrypoint.sh"]
