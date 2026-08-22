import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * DB-free unit tests only.
 *
 * The default config's globalSetup runs `prisma migrate deploy` before ANY
 * vitest invocation, so with PostgreSQL unavailable — a laptop without
 * Docker running, an offline train, a fresh clone — not one of the 19
 * database-free unit files could be run either. That made the fast tests
 * hostage to the slow ones' infrastructure.
 *
 * This config drops globalSetup and the DATABASE_URL repointing, because
 * nothing under tests/unit imports @/lib/db or Prisma. If a unit test ever
 * needs the database it belongs in tests/integration instead — that
 * boundary is the whole point of this file.
 *
 * `npm test` still runs EVERYTHING through vitest.config.ts, so CI coverage
 * is unchanged and this cannot become a way to quietly skip the integration
 * suite.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Next resolves the bare "server-only" specifier itself at build time;
      // under vitest the package does not exist, so importable server modules
      // need the same no-op stub the main config uses.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/unit/**/*.test.ts"],
    testTimeout: 30000,
  },
});
