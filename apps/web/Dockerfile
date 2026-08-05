# Multi-stage Dockerfile for diligence-kit-web.
# Build context: monorepo root (workflow passes context=. and file=apps/web/Dockerfile).
# Pinned SHA preserved from the original diligence-kit-web Dockerfile.

# ---- Base ----
FROM node:24-alpine@sha256:8e2c930fda481a6ec141fe5a88e8c249c69f8102fe98af505f38c081649ea749 AS base
# Bake corepack's pnpm into a shared, world-readable/writable location. The prod
# stage runs as the non-root `node` user, whose default COREPACK_HOME
# (/home/node/.cache/node/corepack) does not exist — without this, `pnpm start`
# tries to download pnpm at runtime, fails to mkdir the cache (ENOENT) and
# crash-loops. Setting COREPACK_HOME here is inherited by every stage.
ENV COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate && chmod -R a+rwX /opt/corepack
WORKDIR /repo

# ---- Deps ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --filter diligence-kit-web...

# ---- Build (Next.js compile; NEXT_PUBLIC_API_BASE_URL injected at build time) ----
FROM deps AS build
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
COPY apps/web ./apps/web
RUN pnpm --filter diligence-kit-web build && chown -R node:node /repo

# ---- Prod target ----
FROM base AS prod
COPY --from=build --chown=node:node /repo /repo
WORKDIR /repo/apps/web
USER node
EXPOSE 3000
CMD ["pnpm", "start"]
