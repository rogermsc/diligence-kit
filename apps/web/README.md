# diligence-kit-web

The dashboard. Next.js 16 App Router, TypeScript, Tailwind 4, Radix primitives.

It is a BFF: every call to the backend is proxied through a route under
`src/app/api/`, so the JWT is set as an httpOnly cookie and never reaches
browser JavaScript.

## Running it

This app is part of the pnpm + Turborepo workspace at the repository root. Run
`pnpm install` there, not here — there is no `package-lock.json` and `npm ci`
will fail.

```bash
cp apps/web/.env.example apps/web/.env   # NEXT_PUBLIC_API_BASE_URL
pnpm --filter diligence-kit-web dev      # http://localhost:3000
```

Requires Node 20 or later, matching the root `package.json` engines field and
the version CI builds on.

To run the whole platform with no cloud account and no API key, use `make demo`
from the repository root instead.

## Layout

```
src/
├── app/            routes, and the API proxy the browser talks to
├── components/     Radix + Tailwind primitives, and the modals
├── data/           repository implementations over the proxy
├── domain/         models and use cases — pure, and unit-tested
├── lib/            the HTTP client, auth cookies, small helpers
└── presentation/   views and view models, one folder per screen
```

`domain/analysis/` holds the arithmetic behind what the screens show: the
evidence index, the scorecard and its weights, the three verification states,
and how a conflict is described. Those are the files with tests, because they
are where a wrong answer would be confident rather than obviously broken.

## Tests

```bash
pnpm --filter diligence-kit-web test
```

Vitest, over the domain layer only. There is no jsdom and no component test —
see `vitest.config.ts` for the reasoning.

## Deploying

`.github/workflows/deploy-web.yml`, which is manual-only. Nothing deploys on a
push to `main`.
