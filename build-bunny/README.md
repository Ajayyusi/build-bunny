# Build Bunny

A premium, playful coding platform for Grades 3–7, sold to UAE schools by NITAQ Academy.
Next.js 15 App Router, TypeScript, Prisma + PostgreSQL, Better Auth, English + Arabic (RTL).

## Prerequisites

- Node.js 22+ (20 minimum)
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
| `npm run db:dev`    | Start embedded PostgreSQL 16          |
| `npm run db:migrate`| `prisma migrate dev`                  |
| `npm run db:deploy` | `prisma migrate deploy` (prod/CI)     |
| `npm run db:seed`   | Seed the NITAQ Demo School            |
| `npm run db:studio` | Prisma Studio                         |

## Architecture

Full plan and milestone breakdown: `../docs/build-bunny/BUILD-BUNNY-PLAN.md`.

```
src/
  app/            # App Router routes (locale-aware), api/ handlers
  modules/        # Domain modules; DB access only in modules/*/server/**
    auth/         # Roles, permissions, session guards, provisioning
    schools/      # Tenant-scoped and platform queries
    platform/     # Cross-cutting server utilities (health, ...)
  lib/            # env, db, auth, audit, events (fenced singletons)
  i18n/           # next-intl routing/request/navigation
  ui/             # Design-system primitives
messages/         # en.json / ar.json translations
prisma/           # Schema, migrations, seed
```

## Deployment

- Build the image from the multi-stage `Dockerfile` (Next.js standalone output,
  non-root, port 3000).
- Release step: run `npx prisma migrate deploy` against the production database
  **before** starting new containers — it is deliberately not part of the
  container CMD.
- Required runtime env vars: `DATABASE_URL`, `BETTER_AUTH_SECRET`,
  `NEXT_PUBLIC_APP_URL` (public origin of the app).
- Health probe: `GET /api/health` — returns `{ ok, db, version }`, 503 when the
  database is unreachable.
