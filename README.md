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

`JWT_SECRET` is required and startup fails below 32 characters. Document storage uses Google Cloud
Storage; credentials go in `apps/<name>/.gcp/credentials.json` (gitignored). Per-app variables are
documented in each app's `env.example` and in `apps/service/ENV_VARIABLES.md`.

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
finished product. There is **no test suite** — the `pnpm test` task exists but runs nothing. Treat the
pipeline as sound and the edges as unproven, and read `CLAUDE.md` for the architectural detail.

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
- **Chunked upload trusts a caller-chosen `identifier`.** The Redis registry keys (`upload:<id>`) have
  no tenant component, so a caller who guesses an in-flight identifier can rebind that upload to their
  own automation. Reachable only via `POST /automation/start/:companyId`, which the UI does not call.
- **The liaison agent resolves companies by unscoped `ILIKE`.** A chat message naming a substring of
  another tenant's company can resolve to that company. The backend now validates any company id or
  automation id the client passes, so this is limited to name-based resolution inside the agent.
- **Chat defaults `user_id` to the literal `"default_user"`** when the caller omits it, pooling those
  conversations under one identity that the per-user history filter then treats as a single owner.
- **`confirm` reports `PROCESSING` even when the agent call failed** and the row was written `FAILED`,
  so the dashboard shows an upload as succeeded.

- **Retry double-prefixes the storage URL.** `retryAutomation` builds `gs://$BUCKET/${doc.bucketPath}`
  where `bucketPath` is already a full `gs://` URI. The agent resolves nothing, and the run completes
  on zero documents while reporting success.
- **ZIP entries are flattened to basenames.** `2023/financials.pdf` and `2024/financials.pdf` collapse
  into one document — the upsert key is `(automationId, name)` — and the loss is silent.
- **The liaison-agent's Alembic migration FKs `users.id`**, which lives in the *other* database. The
  documented `alembic upgrade head` fails until that FK is dropped or the schemas are merged.
- **Agent analysis is fire-and-forget.** `asyncio.create_task` with no reference and an
  `except Exception` handler that `CancelledError` bypasses; a restart mid-run strands the automation
  in `PROCESSING` with no reaper.
- **Scorecard categories are matched on exact strings**, and an unrecognized or missing one is silently
  weighted `0.0` without re-normalizing — understating the headline score with no warning.
- **`.csv` and `.txt` pass the upstream gates but are not in the agent's supported extensions**, so
  they upload successfully and are then discarded.
- **Lint is noisy.** `pnpm lint` reports ~590 pre-existing errors in `apps/service`. Inherited, not
  triaged.

Contributions welcome — see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
