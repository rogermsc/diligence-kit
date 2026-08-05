# diligence-kit-web

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6)
![React](https://img.shields.io/badge/React-19-61DAFB)

Web frontend for the Diligence Kit due diligence platform. A Next.js BFF that proxies AI-powered document analysis between investment analysts and the Diligence Kit backend, keeping credentials server-side at all times.

---

## What it does

Diligence Kit automates investment due diligence. Analysts upload company documents and AI agents classify materials, generate a structured one-pager, and produce specialized reports across four domains: operational, commercial, financial, and cap table & legal.

**Stage 1 — Document triage**
- Upload a ZIP of company documents
- AI classifies documents into 7 categories (Team, Financial, Legal, Corporate, Clients, Investment, Company Summary)
- Missing materials are flagged automatically
- A One Pager summary is generated in markdown

**Stage 2 — Specialized analysis**
- Four parallel AI agents run deep analysis per domain
- Downloadable reports: Operational, Commercial, Financial, Cap Table & Legal
- AI chat assistant scoped to the company context

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5.8 strict |
| UI | React 19 · Tailwind CSS 4 · Radix UI · Lucide React |
| Uploads | resumable.js (chunked, resumable transfers) |
| Rendering | marked · DOMPurify (sanitized markdown) |
| Infra | Docker · GKE · GCP Secret Manager · GitHub Actions |

---

## Getting started

**Prerequisites:** Node.js 24+, access to a running Diligence Kit backend

```bash
# 1. Install dependencies
npm ci

# 2. Configure environment
cp .env.example .env.local
# fill in .env.local — see Environment variables below

# 3. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Base URL of the Diligence Kit backend API (e.g. `https://api.example.com`) |

In production this variable is injected via GCP Secret Manager through the External Secrets Operator (see [`k8s/prod/secrets.yaml`](k8s/prod/secrets.yaml)).

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

---

## Project structure

```
src/
├── app/
│   ├── api/          # Server-side proxy routes (auth, automations, chat, company, documents)
│   └── dashboard/    # Authenticated application pages
├── domain/           # Entities and use case interfaces
├── data/             # Use case implementations and repository adapters
├── presentation/     # React components and ViewModels (hooks)
├── lib/              # Shared utilities (auth-server, httpClient, getBaseUrl)
└── middleware.ts     # Rate limiting (auth, upload, chat, automation endpoints)
```

**Architecture:** Clean Architecture with MVVM on the presentation layer (`Container → ViewModel → View`).

**Key design decisions:**
- All backend calls go through Next.js API routes — JWT never reaches the browser
- Rate limiting is enforced server-side at the middleware layer before any handler runs
- File uploads use resumable chunked transfers — large ZIPs survive network interruptions
- Markdown output from AI is always sanitized with DOMPurify before rendering

---

## Deployment

Production runs on Google Kubernetes Engine. CI/CD is handled by `.github/workflows/deploy.yml` via a shared GKE deployment workflow pinned to a commit SHA. Deployments trigger on push to `main`.

```bash
# Build image locally
docker build -t diligence-kit-web .

# Run with Docker
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=https://api.example.com \
  diligence-kit-web
```

**Production infrastructure** (`k8s/prod/`):

| Concern | Configuration |
|---|---|
| Replicas | 2 (liveness + readiness probes) |
| Security | Non-root user (1000) · read-only filesystem · all capabilities dropped |
| Secrets | GCP Secret Manager via External Secrets Operator |
| Network | NetworkPolicy restricts ingress/egress · HTTPS only via managed certificate |
| Image | Pinned to digest (`node:24-alpine@sha256:...`) |

---

## Security

This app follows the OWASP Top 10 2025 standard. The JWT is held in an httpOnly cookie and every
backend call is proxied through a server-side route, so the token never reaches the browser.

To report a vulnerability, open a security advisory on the GitHub repository.

---

## License

MIT — see [LICENSE](../../LICENSE) at the repository root.
