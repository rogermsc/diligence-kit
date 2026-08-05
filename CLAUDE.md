# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commit policy

Do not include Claude as a co-author on commits. Omit any `Co-Authored-By: Claude...` trailer and any `🤖 Generated with Claude Code` footer. Authorship should reflect only the human committer.

## Project Overview

Diligence Kit is an investment due diligence automation platform. It processes company dataroom documents through AI agents that perform triage, multi-domain diligence analysis, and one-pager generation. A liaison agent provides customer support chat.

This is a **pnpm + Turborepo monorepo** containing 4 services under `apps/`. The two JavaScript apps participate in the Turborepo pipeline; the two Python apps live in `apps/` for layout consistency but are managed independently (pip / Poetry).

## Repository Layout

```
apps/
├── service/         NestJS 11 backend (port 3001)
├── web/             Next.js 16 frontend (port 3000)
├── agent/           FastAPI agent for triage / diligence / one-pager (port 8000)
└── liaison-agent/   FastAPI customer-support chat agent (port 8000)
.github/workflows/   One deploy workflow per app, with path filters
docker-compose.dev.yml  Postgres + Redis for local dev
infra/dev/           Init SQL for dev Postgres
```

## Build & Development Commands

### Root (Turborepo)

```bash
pnpm install                     # install all JS deps for service + web
pnpm build                       # build both JS apps (turbo)
pnpm lint                        # lint both JS apps
docker compose -f docker-compose.dev.yml up -d    # start postgres + redis
```

### apps/service (NestJS)

```bash
cd apps/service
pnpm install                     # rarely needed — root pnpm install covers it
npx prisma migrate deploy        # apply migrations
npx prisma migrate dev           # create new migration
pnpm start:dev                   # dev with watch
pnpm build                       # compile to dist/
pnpm start:prod                  # production (node dist/main)
pnpm test                        # jest unit tests (*.spec.ts)
pnpm test:e2e                    # e2e tests
pnpm lint                        # eslint with auto-fix
npx prisma studio                # database GUI
pnpm exec ts-node -r tsconfig-paths/register scripts/create-user.ts <email> <password>
```

Swagger docs available at `http://localhost:3001/api` when running.

### apps/web (Next.js)

```bash
cd apps/web
pnpm dev                         # dev server at :3000
pnpm build
pnpm lint
```

Requires `NEXT_PUBLIC_API_BASE_URL` in `.env`.

### apps/agent (Python / FastAPI)

```bash
cd apps/agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m src.main               # serves :8000
```

### apps/liaison-agent (Python / FastAPI + Poetry)

```bash
cd apps/liaison-agent
poetry install
poetry run alembic upgrade head  # apply migrations
poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The liaison agent uses Alembic against its own database (`diligence_kit_liaison` in dev).

## Architecture

### Backend (apps/service)

Clean Architecture / DDD with feature modules under `src/features/`:
- **auth** — JWT authentication (login, refresh tokens)
- **company** — Company CRUD
- **automation** — Document upload, processing orchestration, status tracking
- **report-agents** — Coordinates multi-domain diligence reports
- **onePager-agent** — One-pager generation workflow
- **liaison** — Chat integration with liaison agent

Patterns: use cases per feature, Prisma ORM, Zod DTOs, Bull (Redis) for async jobs, RabbitMQ via `@golevelup/nestjs-rabbitmq` for inter-service messaging where used, Google Cloud Storage for document files. TypeScript path aliases: `@/*`, `@/features/*`, `@/shared/*`.

### Database (Prisma)

Core models: `Company` → `Automation` (with parent/child self-relation) → `Documents`, `Result` → `OutputDocument`, `Report`, `OnePager`, `User`/`RefreshToken`.

Automation stages flow: `TRIAGE` → `DILLIGENCE_OPERATIONAL` → `DILLIGENCE_COMMERCIAL` → `DILLIGENCE_FINANCIAL` → `DILLIGENCE_CAP_TABLE_AND_LEGAL_REVIEW`.

### Frontend (apps/web)

Next.js App Router with `src/`: `app/` pages, `components/` (Radix UI + Tailwind 4), `domain/` business logic, `data/` API clients. Path alias `@/*` → `./src/*`.

### Python Agents

Layered/hexagonal architecture with ports and adapters. Agent uses `src/`; liaison-agent uses `app/`. The agent serves both `/api/v1/analyze` (one-pager) and `/api/v1/diligence` (4 domain reports) on a single FastAPI process. The liaison-agent runs LangGraph chat with intent routing and connects to its own Postgres via cloud-sql-proxy in prod.

Inter-service: backend orchestrates the pipeline; agents emit results back via webhook (HMAC-SHA256 signed). The liaison-agent has no inbound dependency on the others — it consumes Cloud Logging for ombudsman analysis.

## Infrastructure

- **PostgreSQL 15** — Primary DB (service + liaison-agent; separate databases)
- **Redis 7** — Bull queues + cache (port 6381 in dev to avoid clashing with system Redis)
- **Google Cloud Storage** — Document files
- **OpenAI** — Embeddings + LLM (agent)
- **Google Vertex AI** — Gemini (liaison-agent)

## Deployment

`.github/workflows/deploy.yml` orchestrates all four apps, using `dorny/paths-filter` so a change in one app doesn't rebuild the others. Each app has its own `deploy-<app>.yml` (called via `workflow_call`, or run directly via `workflow_dispatch`) with inline build/push/deploy steps. Production K8s manifests live under `apps/<name>/k8s/prod/`.

These workflows ship as a reference implementation and are **manual-only** — the orchestrator has no `push` trigger. The manifests carry placeholders (`your-gcp-project-id`, `your-gke-cluster`, `your-cloudsql-instance`, `example.com`); point them at your own GCP project and set the `GCP_PROJECT_ID` / `GCP_SERVICE_ACCOUNT_CREDENTIALS` repository secrets before enabling a push trigger.

## Environment Setup

Each app has its own `.env.example` (or `env.example`):
- `apps/service/.env.example` — DB, Redis, JWT, GCS, agent URLs
- `apps/web/.env.example` — NEXT_PUBLIC_API_BASE_URL
- `apps/agent/env.example` — OpenAI, GCS, backend callback URLs, JWT/HMAC secrets
- `apps/liaison-agent/env.example` — DB, GCP location, API key

GCP credentials go in `apps/<name>/.gcp/credentials.json` (gitignored).
