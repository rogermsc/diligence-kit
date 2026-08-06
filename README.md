<p align="center">
  <img src="apps/web/public/diligence-kit-logo.svg" width="88" alt="">
</p>

<h1 align="center">Diligence Kit</h1>

<p align="center">
  An open-source platform for automating investment due diligence on a company dataroom.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT">
  <img src="https://img.shields.io/badge/NestJS-11-E0234E" alt="NestJS 11">
  <img src="https://img.shields.io/badge/Next.js-16-black" alt="Next.js 16">
  <img src="https://img.shields.io/badge/FastAPI-Python%203.10+-009688" alt="FastAPI">
</p>

---

Upload a company's dataroom and Diligence Kit classifies the documents, extracts facts from each one,
reconciles the contradictions between them, and produces two kinds of deliverable:

- **A one-pager** — an investment memorandum with an executive summary, financial highlights, and a
  weighted 8-category investment-readiness scorecard.
- **Four domain reports** — operational, commercial, financial, and cap-table & legal review.

Both are rendered into DOCX from templates you control, then converted to PDF.

A second agent handles support chat: it classifies intent, and when a user reports a failed run it
reads the platform's own logs and explains what broke in plain language.

## Why it's built this way

The interesting problem in document diligence is not summarization — it is **disagreement**. A
dataroom contains a pitch deck, a financial model, and an auditor's report that state three different
revenue figures. So extraction and synthesis are separate stages: facts are pulled per document with
provenance, conflicts are resolved explicitly (`conflict_resolution_service.py`), and only then does
the analyst prompt run. The prompts enforce actual-vs-pro-forma-vs-projection discipline and refuse to
invent ranges. That discipline lives in `apps/agent/src/core/prompts/` and is the part worth reading.

## Architecture

| Path | Stack | Port | Role |
| --- | --- | --- | --- |
| `apps/service` | NestJS 11 (TypeScript) | 3001 | Orchestrator — auth, companies, uploads, pipeline, job queue |
| `apps/web` | Next.js 16 (TypeScript) | 3000 | Dashboard. A BFF: every API call is proxied server-side so the JWT never reaches the browser |
| `apps/agent` | FastAPI (Python) | 8000 | Extraction, diligence synthesis, one-pager, DOCX/PDF rendering |
| `apps/liaison-agent` | FastAPI + LangGraph (Python) | 8000 | Support chat with intent routing and log-reading ombudsman |

The backend orchestrates the pipeline; agents return results via HMAC-SHA256-signed webhooks. Stages
run `TRIAGE → DILLIGENCE_OPERATIONAL → DILLIGENCE_COMMERCIAL → DILLIGENCE_FINANCIAL →
DILLIGENCE_CAP_TABLE_AND_LEGAL_REVIEW` — the double-L is a typo baked into the Postgres enum, kept
because renaming it means migrating live data. The two JavaScript apps are a pnpm + Turborepo
workspace; the two Python apps sit in `apps/` for layout symmetry but are pip / Poetry projects.

## Try it

```bash
make demo
```

Docker only. No cloud account, no API key. It brings up the four services, seeds
a user, and lands you on a **completed analysis** of a four-document dataroom for a
fictional company — where the pitch deck, the financial model and the audited accounts
state FY2024 revenue as £4.1M, £3.8M and £3.2M respectively. Reconciling that is the
product; a dataroom where every document agrees would demonstrate none of it.

Sign in at [localhost:3000](http://localhost:3000) with `you@example.com` / `demo-password`.

Storage is a local volume (`STORAGE_DRIVER=local`) and the agent replays recorded model
responses (`LLM_DRIVER=replay`), so the whole thing runs offline. `make demo-down` removes it.

## Quick start

Requires Node 20+, pnpm 9, Python 3.10+, Docker, and an OpenAI API key.

```bash
# 1. JS deps
pnpm install

# 2. Dev infra (postgres + redis)
docker compose -f docker-compose.dev.yml up -d

# 3. Env files — fill in the placeholders, especially the three 32-char secrets
cp apps/service/.env.example        apps/service/.env
cp apps/web/.env.example            apps/web/.env
cp apps/agent/env.example           apps/agent/.env
cp apps/liaison-agent/env.example   apps/liaison-agent/.env

# 4. Migrations
(cd apps/service && npx prisma migrate deploy)
(cd apps/liaison-agent && poetry install && poetry run alembic upgrade head)

# 5. Run (separate terminals)
pnpm --filter diligence-kit-service start:dev              # :3001, Swagger at /api
pnpm --filter diligence-kit-web dev                        # :3000
(cd apps/agent && python -m src.main)                      # :8000
(cd apps/liaison-agent && poetry run uvicorn app.main:app --port 8001)
```

Create your first user:

```bash
cd apps/service
pnpm exec ts-node -r tsconfig-paths/register scripts/create-user.ts you@example.com yourpassword
```

## Configuration

Three shared secrets connect the services, each at least 32 characters:

| Variable | Purpose |
| --- | --- |
| `AGENT_SECRET` | Signs outbound JWTs from backend to agent |
| `AGENT_API_KEY` | Inbound `X-API-Key` on agent endpoints |
| `WEBHOOK_SECRET` | HMAC-SHA256 signature on agent → backend callbacks |

`JWT_SECRET` is required and startup fails below 32 characters. Per-app variables are documented in
each app's `env.example` and in `apps/service/ENV_VARIABLES.md`.

Two drivers decide what the platform depends on:

| Variable | Options | Notes |
| --- | --- | --- |
| `STORAGE_DRIVER` | `gcs` (default), `local` | Both produce `gs://<bucket>/<key>` URLs, so stored paths stay portable between them. GCS credentials go in `apps/<name>/.gcp/credentials.json` (gitignored). |
| `LLM_DRIVER` | `openai` (default), `replay` | `replay` serves recorded responses from `apps/agent/fixtures/llm`. Set `LLM_RECORD=1` alongside `openai` to capture a live run for later replay. |

Models are configured per purpose (`LLM_MODEL_FACT_EXTRACTION`, `LLM_MODEL_ONE_PAGER`, and so on)
rather than hardcoded, and `OPENAI_BASE_URL` points the agent at any OpenAI-compatible endpoint.

## Branding the output

Report headers and footers are not hardcoded. Set `REPORT_PREPARED_BY` to your firm's name and it
flows into every generated document. To change the mark, replace `word/media/image1.png` inside the
templates in `apps/agent/src/templates/` and `apps/agent/src/assets/`.

## Deploying

`.github/workflows/` contains a complete GKE pipeline: `dorny/paths-filter` decides which apps
changed, each app builds and pushes to Artifact Registry, and the deployment is pinned to the image
digest rather than a mutable tag.

It ships **manual-only** (`workflow_dispatch`) because the manifests carry placeholders. To use it:
replace `your-gcp-project-id`, `your-gke-cluster`, `your-cloudsql-instance` and `example.com` under
`apps/*/k8s/prod/`, set the `GCP_PROJECT_ID` and `GCP_SERVICE_ACCOUNT_CREDENTIALS` repository secrets,
then add a `push` trigger to `deploy.yml`. Secrets are pulled at runtime from GCP Secret Manager via
the External Secrets Operator — none live in the repo.

Nothing ties the code to GKE: the apps are four containers with Postgres and Redis behind them.

## Status

Working software extracted from a production deployment, published as a starting point rather than a
finished product. Read `CLAUDE.md` for the architectural detail.

Every pull request builds, typechecks, lints and tests both JavaScript apps, and lints both Python
ones. `apps/agent` has a test suite; `apps/liaison-agent` does not yet, and CI says so rather than
reporting a pass. Coverage is deliberately narrow rather than broad — it covers the places that fail
quietly:

```bash
make test     # jest + pytest
make lint     # eslint + ruff across all four apps
```

The agent's suite includes an end-to-end run of the whole pipeline against the committed dataroom,
offline, in about a second. Because each recorded response is keyed by a hash of the exact prompt,
editing a prompt makes replay miss and that test fail — which is the intended alarm, not a flake.
Re-record with `python scripts/record_demo_fixtures.py`.

The ~575 inherited type-safety lint violations are captured in `apps/service/eslint-suppressions.json`
so they don't block work; any newly introduced error fails the build.

### Authorization

Every authenticated route declares what it touches — `@Tenancy({automation: "param:automationId"})`,
or `@NoTenancy("reason")` for routes that create a record or list records the repository already
scopes to the caller. A global interceptor enforces the declaration and **denies by default**, so a
route that authenticates a user and declares nothing is refused rather than quietly serving. A spec
walks every registered route and fails the build if any lacks a declaration.

Ownership failures return 404, not 403: a 403 confirms that an id exists, which is what an
id-guessing attacker is trying to learn.

### Upgrading

Access and refresh tokens now carry a `typ` claim that both verifiers require, so **every token issued
before this change is rejected** — all users must log in again after deploying. The dashboard has no
refresh route, so a stale cookie renders as logged-in while every data call 401s; clearing cookies
fixes it. Adding a refresh endpoint to the web BFF is the obvious follow-up: `setSessionCookies`
already writes a 7-day refresh cookie that nothing currently reads, so sessions expire hard at 24h.

Run the ownership migration before anyone logs in, then check who owns what — see the query at the
top of `prisma/migrations/*_add_company_owner/migration.sql`.

### Known issues

An audit turned these up. They are listed rather than hidden, but they are not fixed — budget for them
before running this on anything that matters:

- **Storage paths are namespaced by company *name*, not id.** That is why company names must be
  globally unique rather than per-owner, which leaks the existence of other tenants' company names at
  creation time. Namespacing by company id would remove both problems; it touches the chunked-upload
  subsystem, so it is not done here.
- **The stale-run reaper measures wall-clock, not liveness.** Nothing writes to an automation row
  while the agent works, so a slow healthy run is indistinguishable from an abandoned one. If one is
  failed while still executing, retrying it dispatches the same automation to the agent twice.
  `AUTOMATION_TIMEOUT_MINUTES` defaults to 240 for that reason; a heartbeat written by the agent is
  the real fix and is not implemented.
- **`apps/liaison-agent` has no tests.** CI lints it and emits a warning that it has none.

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
