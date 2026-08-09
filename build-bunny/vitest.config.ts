import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Next.js resolves the bare "server-only" specifier itself at build
      // time; under vitest the package does not exist, so server modules
      // (data layer, provisioning) need a no-op stub to be importable.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["tests/setup-env.ts"],
    globalSetup: ["tests/global-setup.ts"],
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    // Suites share the single bunny_test database and wipe it in beforeAll —
    // files must never run against it concurrently.
    fileParallelism: false,
  },
});
