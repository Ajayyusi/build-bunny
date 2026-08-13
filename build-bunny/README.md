# Build Bunny

A premium, playful coding platform for Grades 3–7, sold to UAE schools by NITAQ Academy.
Next.js 15 App Router, TypeScript, Prisma + PostgreSQL, Better Auth, English + Arabic (RTL).

## Prerequisites

- Node.js 22.12+ (enforced by `engines` in package.json; `.nvmrc` provided)
- Docker (optional — only if you prefer containerized Postgres over the embedded one)

## Quickstart

```bash
cp .env.example .env
npm i

# Database — pick one:
npm run db:dev            # embedded PostgreSQL 16 (no Docker needed)
# ...or:
docker compose up -d      # postgres:16 with bunny_dev + bunny_test

npm run db:migrate
npm run db:seed
npm run dev
```

Demo credentials are written to `prisma/seed-output/credentials.md` after seeding
(never committed).

## Commands

| Command             | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Start the dev server                  |
| `npm run build`     | Production build                      |
| `npm run lint`      | ESLint                                |
| `npm run typecheck` | `tsc --noEmit`                        |
| `npm test`          | Vitest (uses `TEST_DATABASE_URL`)     |
| `npm run test:watch`| Vitest in watch mode                  |
| `npm run db:dev`    | Start embedded PostgreSQL 16          |
| `npm run db:migrate`| `prisma migrate dev`                  |
| `npm run db:deploy` | `prisma migrate deploy` (prod/CI)     |
| `npm run db:seed`   | Seed the NITAQ Demo School            |
| `npm run db:studio` | Prisma Studio                         |
| `npm run demo:reset`| Reset the DEMO school for a sales demo (see `docs/demo-script.md`) |
| `npm run dev:skip-to`| Jump a dev student to a given level without playing to it |
| `npm run load-check`| Concurrent-submission load test against a dev server |

## Architecture

Master plan and decision record: `../docs/build-bunny/BUILD-BUNNY-PLAN.md`.
Current polish/productionization plan: `../docs/build-bunny/IMPLEMENTATION-PLAN-2026-08.md`.
Operational docs (deploy, demo script, privacy, accessibility, AI data flow):
`docs/` inside this directory.

```
src/
  app/            # App Router routes (locale-aware), api/ handlers
  engine/         # Pure deterministic grid/simulation engine (no app imports)
  modules/        # Domain modules; DB access only in modules/*/server/**
    activities/   # Activity players (client) + grader registry (server)
    ai/           # Deterministic AI engines: 1-NN, k-means, AI_SIM widgets, ethics
    analytics/    # Class matrix, student flags, teacher analytics
    assignments/  # Assignment create/close, force-unlock
    auth/         # Roles, permissions, session guards, provisioning
    blockly/      # Blockly blocks, themes, headless server codegen
    certificates/ # Issuance, public QR verify
    curriculum/   # Content schemas, import/publish pipeline, payload stripping
    grading/      # Server-authoritative attempt submission pipeline
    learning/     # Progress, unlocks, streaks, achievements
    platform/     # NITAQ console services (health, audit, users)
    schools/      # Tenant-scoped school/class/student queries
    shared/       # Feature flags
    simulation/   # Client playback for the grid engine
    students/     # Student home/adventure/profile queries
  lib/            # env, db, auth, audit, events (fenced singletons)
  i18n/           # next-intl routing/request/navigation
  ui/             # Design-system primitives
content/          # Curriculum source fixtures (worlds/levels), imported into the DB
messages/         # en.json / ar.json translations
prisma/           # Schema, migrations, seed
scripts/          # dev DB, demo reset, content import, load-check, skip-to
tests/            # Vitest unit + integration suites (real PostgreSQL)
```

## Deployment

- Build the image from the multi-stage `Dockerfile` (Next.js standalone output,
  non-root, port 3000).
- Release step: run `npx prisma migrate deploy` against the production database
  **before** starting new containers — it is deliberately not part of the
  container CMD.
- Required runtime env vars: `DATABASE_URL`, `BETTER_AUTH_SECRET`,
  `NEXT_PUBLIC_APP_URL` (public origin of the app).
- Health probe: `GET /api/health` — returns `{ ok, db, version, migrations:
  { applied, expected, upToDate }, content: { publishedLevels } }`, 503 when
  the database is unreachable.
