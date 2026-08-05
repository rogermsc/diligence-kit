# Contributing

Thanks for taking a look. Issues and pull requests are both welcome.

## Before you start

There is **no test suite** — `pnpm test` is wired up but runs nothing. That is the honest state of the
project, and it means changes are verified by running the thing. If you add tests alongside a change,
even better.

Please open an issue before starting anything large, so you don't build something that doesn't fit.

## Getting set up

Follow the quick start in [README.md](README.md). You need Node 20+, pnpm 9, Python 3.10+, Docker, and
an OpenAI API key. The dev Postgres and Redis come from `docker-compose.dev.yml`; the apps run
natively.

## Making a change

```bash
pnpm lint         # eslint across service + web, with --fix
pnpm build        # both JS apps must compile
```

For the Python apps, run the app and exercise the endpoint you touched. If you changed a DOCX
template or the renderer, render one report end to end and open the file — template edits break
quietly.

Schema changes go through Prisma:

```bash
cd apps/service && npx prisma migrate dev --name what_you_changed
```

Commit the generated migration. Never edit an applied migration.

## Conventions

- Each app follows the same layering (`domain` / `data` / `infra` / `presentation` / use cases). Put
  new code where the existing code of that kind already lives.
- TypeScript path aliases are `@/*`, `@/features/*`, `@/shared/*`.
- Keep the frontend's server-side proxy pattern intact: the JWT lives in an httpOnly cookie and must
  never be exposed to client-side code.
- No secrets, project IDs, hostnames, or customer names in commits. Deployment identifiers are
  placeholders on purpose — leave them that way.

## Pull requests

Describe what changed and how you verified it. Small, focused PRs get reviewed faster than large ones.

By contributing you agree your work is licensed under the MIT License.
