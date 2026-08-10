# Build Bunny — Operations

Deployment, backup/restore, and the classroom-load numbers behind the M5
performance sign-off. App root: `C:\Users\User\Nitaq\build-bunny`.

## 1. Environment variables

All validated at boot by `src/lib/env.ts` (`env.ts` throws with a readable
list of what's missing/invalid — the app never runs half-configured).

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | `postgresql://user:pass@host:5432/db`. Must be UTF8-encoded (see §4) — Arabic content cannot be stored in a WIN1252/ASCII database. |
| `TEST_DATABASE_URL` | test runs only | Never point this at a database with real data — the suite wipes it. |
| `BETTER_AUTH_SECRET` | yes | ≥16 chars. Generate with `openssl rand -base64 32`. Rotating it invalidates every existing session. |
| `NEXT_PUBLIC_APP_URL` | yes | The canonical origin. Must exactly match what the app is served at — Better Auth's `trustedOrigins` and the CSRF origin check both key off it, so a mismatch here manifests as sign-in/mutation requests failing with an origin error, not a helpful "wrong env var" message. |
| `NODE_ENV` | no (default `development`) | Set `production` in deploy. Also silences the extra Prisma query logging. |
| `PORT` | no (default `3000`) | Read directly by the standalone server (`node .next/standalone/server.js`), not by `env.ts`. |

Not yet a variable, hardcoded per plan §M2: default school timezone
`Asia/Dubai`, default school week `Mon–Fri` (overridable per school via
`School.weekStructure`).

## 2. Deploy

The app builds `output: "standalone"` (`next.config.ts`) — a self-contained
`.next/standalone/server.js` plus the node_modules it actually needs, meant
to run without a full `npm install` on the target host.

```bash
# 1. Install, build
npm ci
npm run build

# 2. Standalone output needs its static assets copied alongside it —
#    `next build` does not do this automatically.
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# 3. Apply migrations — NEVER `migrate dev` in production (it can prompt
#    for a destructive reset if it detects drift; `migrate deploy` only
#    ever applies forward, never touches the schema interactively).
DATABASE_URL="postgresql://..." npx prisma migrate deploy

# 4. Start
PORT=3000 NODE_ENV=production DATABASE_URL="postgresql://..." \
  NEXT_PUBLIC_APP_URL="https://your-domain" BETTER_AUTH_SECRET="..." \
  node .next/standalone/server.js
```

Health check for the load balancer / orchestrator: `GET /api/health`,
unauthenticated, cheap (one `SELECT 1`, one `COUNT(*)` on the tiny
`_prisma_migrations` table, one indexed `Level` count — see §5 for why this
is safe to poll frequently). Returns `200` when the DB is reachable and the
applied migration count matches what's on disk; `503` otherwise. Shape:

```json
{
  "ok": true,
  "db": true,
  "version": "0.1.0",
  "migrations": { "applied": 4, "expected": 4, "upToDate": true },
  "content": { "publishedLevels": 17 }
}
```

`migrations.expected` is `null` (never fails health on its own) when the
`prisma/migrations` directory isn't reachable from the process's working
directory — that only happens if a deploy copied `server.js` without also
carrying `prisma/` alongside it, which `migrate deploy` in step 3 needs
anyway, so any real deployment has it.

Seeding (first deploy of a fresh database only — `db:seed` is meant for the
demo/dev database, not a customer's):

```bash
npm run db:seed
```

## 3. Backup & restore

### Local dev database

This repo's dev/test Postgres is the `embedded-postgres` npm package (see
`scripts/dev-db.ts`) — a project-local PostgreSQL 16 with **no client tools
installed alongside it** (`node_modules/@embedded-postgres/*/native/bin`
ships only `postgres`, `pg_ctl`, `initdb` — no `pg_dump`/`pg_restore`/`psql`).
`docker-compose.yml` is the alternative (`postgres:16-alpine`, full image) —
prefer it if you need the client tools on the same host.

### Production

Use the real PostgreSQL 16 client tools (`postgresql-client-16` on Debian/
Ubuntu, or the official postgres:16 Docker image if the host has none
installed) — a client OLDER than the server is not reliably supported (dumps
against a newer server should use an equal-or-newer `pg_dump`).

**Backup:**

```bash
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p 5432 -U bunny -d bunny_prod \
  -F c -f "bunny_prod_$(date +%Y%m%d_%H%M%S).dump"
```

`-F c` (custom format) is compressed and lets `pg_restore` do parallel
restores and selective table restores — prefer it over plain SQL dumps.

**Restore (into a NEW/empty database — never over a live one):**

```bash
createdb -h "$DB_HOST" -U bunny bunny_restored
pg_restore -h "$DB_HOST" -p 5432 -U bunny -d bunny_restored \
  --no-owner --no-privileges bunny_prod_20260810_030000.dump
```

`createdb`'s default template inherits the cluster's initdb encoding — on a
cluster initialised under a non-UTF8 locale (this bit us in dev on Windows,
see `scripts/dev-db.ts`) a plain `createdb` silently produces a database that
**rejects Arabic content** on restore with `character ... has no equivalent
in encoding WIN1252`. If restoring onto an unfamiliar/unverified cluster,
create the target explicitly instead:

```sql
CREATE DATABASE bunny_restored TEMPLATE template0 ENCODING 'UTF8';
```

**Schedule:** nightly full dump, 35-day rolling retention (matches
`docs/build-bunny/design/security-rbac.md` §7.5's documented backup
retention — backups are noted as containing pre-deletion data, standard DPA
language). Store dumps in the same UAE region as the database (§4).

### Restore drill actually performed (2026-08-10, against `bunny_test`)

This sandbox has no native `pg_dump`/`pg_restore`/`psql` (see above) and the
one copy of `pg_dump` found on the machine (bundled with unrelated software)
was v13.4 — too old for a v16 server and refuses to run (`pg_dump: error:
server version: 16.14; pg_dump version: 13.4`). The drill below used a
disposable, version-matched client instead — Docker's official `postgres:16`
image, run purely as a CLI (never as a second database):

```bash
docker run -d --name bb_restore_drill --entrypoint sleep postgres:16 infinity

# 1. Baseline: row count per table in bunny_test (all 31 tables)
docker exec -e PGPASSWORD=bunny bb_restore_drill psql \
  -h host.docker.internal -p 5432 -U bunny -d bunny_test -t -c "
    SELECT table_name || ': ' ||
      (xpath('/row/c/text()', query_to_xml(
        format('SELECT count(*) AS c FROM %I', table_name), false, true, ''
      )))[1]::text
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY table_name;"

# 2. Backup
docker exec -e PGPASSWORD=bunny bb_restore_drill pg_dump \
  -h host.docker.internal -p 5432 -U bunny -d bunny_test -F c -f /tmp/bunny_test.dump
docker cp bb_restore_drill:/tmp/bunny_test.dump ./bunny_test.dump   # 89,179 bytes

# 3. Restore into a scratch database (UTF8-explicit — see the encoding note above;
#    the plain `createdb` form failed the first attempt with exactly the WIN1252 error described)
docker exec -e PGPASSWORD=bunny bb_restore_drill psql -h host.docker.internal -p 5432 -U bunny -d postgres \
  -c "CREATE DATABASE bunny_restore_drill TEMPLATE template0 ENCODING 'UTF8';"
docker exec -e PGPASSWORD=bunny bb_restore_drill pg_restore \
  -h host.docker.internal -p 5432 -U bunny -d bunny_restore_drill \
  --no-owner --no-privileges /tmp/bunny_test.dump
# → exit 0, clean restore

# 4. Verify: same per-table count query against bunny_restore_drill, diffed against step 1
```

**Result:** all 31 tables matched exactly, including the two that mattered
most for this drill — `AuditLog: 14` and `_prisma_migrations: 4` were
identical before and after. Spot-checked Arabic JSON content survived
byte-for-byte (`World.name`: `{"ar": "مرج الاختبار", "en": "Pipeline
Meadow"}` in both databases). Cleaned up afterward: dropped
`bunny_restore_drill`, removed the container and the local dump file — the
drill leaves no trace in either database.

**Finding to carry into the real deploy runbook:** whatever host runs
backups/restores in production must have `pg_dump`/`pg_restore` matching
(or newer than) the server's major version, or the same "run it via the
official `postgres:16` Docker image" trick used here works as a permanent,
zero-install substitute — pin the image tag to the deployed server's major
version.

## 4. UAE-region notes

- School default timezone is `Asia/Dubai` (`School.timezone`, per-school
  overridable); streaks and "this school day" calculations (§ engine) run
  in the school's own timezone, not server-local time.
- Per `docs/build-bunny/design/security-rbac.md` §7 (PDPL-readiness):
  production database, object storage, and backups should live in a UAE
  region (AWS `me-central-1` or Azure `UAE North`) with no cross-border
  transfer without the school's (the data controller's) instruction. This
  is a deployment-target choice, not something the app enforces in code —
  whoever provisions the production Postgres instance needs to pick a
  UAE-region host/managed database explicitly.
- Student data minimization is enforced at the CSV importer boundary (no
  DOB/address/phone/photo columns are ever accepted) — see
  `docs/privacy-data-inventory.md` for the full field inventory.

## 5. Load sanity — the classroom case

`scripts/load-check.ts` fires N concurrent, REAL attempt submissions (the
level's own authored solution, fetched from the published snapshot, so every
run takes the full PASS path — reward transaction, XP ledger, achievement
evaluation, streak upsert — not a shortcut FAIL) against a running instance,
using the seeded DEMO school's students, and reports p50/p95/max latency,
error count and throughput.

```bash
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
PORT=3005 NODE_ENV=production DATABASE_URL="postgresql://bunny:bunny@localhost:5432/bunny_dev" \
  NEXT_PUBLIC_APP_URL="http://localhost:3005" BETTER_AUTH_SECRET="<same as .env>" \
  node .next/standalone/server.js &

npm run load-check -- --n=40 --base-url=http://localhost:3005

# afterward — the run awards real XP/progress against bunny_dev:
npm run demo:reset
```

### Results (measured 2026-08-10, 40 concurrent submissions, real production standalone server, real Postgres)

**First run — found a real pathology.** 13 of 40 concurrent submissions
(32.5%) failed with a 500. The server log showed the actual cause:

```
prisma:error
Invalid `prisma.xpEvent.createMany()` invocation:
Unique constraint failed on the fields: (`studentUserId`,`levelId`,`source`)
```

Root cause (`src/modules/grading/server/submit.ts`, the reward transaction):
the code read the student's existing `XpEvent` rows, decided which awards
were new, then `createMany`'d them. Under genuine concurrency — the load
test's 40 submissions necessarily reuse a small pool of 8 authenticated
students (see the sign-in-rate-limit note in §5's script), so several
requests per student land at the same instant — two transactions for the
*same student + same level* both read "not yet awarded" under READ
COMMITTED before either commits, both try to insert the same
`(studentUserId, levelId, source)` row, and the loser's `createMany` throws
instead of degrading gracefully. This is a real bug a classroom can hit
(two fast clicks on Run, a flaky retry, not just a load test).

| Metric | First run (buggy) | After fix |
| --- | ---: | ---: |
| Concurrency | 40 | 40 |
| Wall time | 0.53 s | 0.52 s |
| p50 latency | 467 ms | 477 ms |
| p95 latency | 524 ms | 510 ms |
| max latency | 528 ms | 523 ms |
| Errors | **13/40 (32.5%)** | **0/40** |
| Throughput | 75.4 req/s | 76.3 req/s |
| Status breakdown | `{"200":27,"500":13}` | `{"200":40}` |

**Fix applied:** replaced the batched `createMany` with a per-row `create`
inside the same transaction, catching a `P2002` unique violation as "a
concurrent attempt already won this award" rather than letting it crash the
request. Critically, `xpAwarded` (used both for the response and for the
`StudentProfile.xpTotal` increment) is now computed from what **actually**
got inserted, not the pre-transaction snapshot — so the fix doesn't just
stop the crash, it also closes a latent XP-total drift bug the old code
would have hit silently (an over-count) if `skipDuplicates: true` had been
used instead of fixing the accounting. Re-running the identical 40-concurrent
scenario after the fix: **0 errors**, same latency profile (the extra
per-row round trips cost ~10ms at p50, invisible next to network/grading
time). Verified server-side too — `standalone-server3.log` from the second
run has zero `prisma:error` lines and 40 logged `"status":200` lines.

Latency itself (~470-520ms per attempt, including full grading — Blockly
codegen, js-interpreter run, the reward transaction, achievement
evaluation, streak upsert) was never the concern; the classroom case (40
submissions arriving close together) resolves in ~0.5 seconds wall-clock on
a single instance either way. The pathology was correctness under
concurrency, not throughput.

`src/modules/grading/server/submit.ts` is the only file this fix touched.

## 6. Player bundle — Blockly code-splitting

`src/modules/blockly` (Blockly + js-interpreter) is only ever imported from
the immersive player route (`(student)/(immersive)/play/[levelId]`) and the
teacher attempt-replay route — never from a shell layout or the map/home
pages, so Next's route-level code splitting should keep it out of every
route a student or teacher loads before actually opening a level.

Verified by inspecting the real production build output (`npm run build`'s
route size table, then cross-checked against `.next/react-loadable-manifest.json`
and the actual chunk file sizes on disk):

| Route | Page size | First Load JS |
| --- | ---: | ---: |
| `/[locale]/home` | 3.91 kB | 123 kB |
| `/[locale]/adventure` | 5.72 kB | 128 kB |
| `/[locale]/play/[levelId]` | 3.24 kB | 122 kB |

All three are within a few kB of each other — none carries Blockly. Confirmed
directly from `react-loadable-manifest.json`: the ONLY two places in the
whole app that `next/dynamic`-import `@/modules/blockly/BlocklyWorkspace` are
`modules/activities/players/GridPlayer.tsx` (which `/play/[levelId]`
dispatches to only for `BLOCK_CODING`/`DEBUGGING` levels) and
`(staff)/teach/attempts/[attemptId]/_components/ReplayViewer.tsx` (teacher
attempt replay) — never `/home`, `/adventure`, or any shell layout. The
webpack bundle graph has no edge from those routes' entry chunks to
Blockly's chunks; the library is fetched only once a player component
actually mounts.

The Blockly chunk itself is real weight, correctly deferred:

| Chunk (via GridPlayer, i.e. what `/play/[levelId]` fetches on mount) | Size |
| --- | ---: |
| `chunks/6321.*.js` | 162.0 kB |
| `chunks/107.*.js` | 2.6 kB |
| **Total, loaded only when a grid-coding level actually opens** | **~164.6 kB** |

(The teacher replay route's dynamic import pulls a larger, overlapping set —
`42d4cfa6.*.js` 630.1 kB + `6321.*.js` 162.0 kB + `2488.*.js` 12.8 kB ≈
805 kB — reasonable for a staff-only, occasionally-visited debugging page.)

**Conclusion:** Blockly is correctly code-split away from every shell route.
A student browsing `/home` and `/adventure` never downloads it; it loads
exactly once, lazily, the moment a BLOCK_CODING/DEBUGGING level's workspace
actually renders.
