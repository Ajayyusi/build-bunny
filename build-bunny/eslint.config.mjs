import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "next-env.d.ts",
      "prisma/migrations/**",
    ],
  },

  // ── Engine purity: src/engine must stay deterministic and dependency-free ──
  // No React/Next/DOM/app imports; no wall-clock or randomness. The engine runs
  // identically in the browser (animation) and on the server (authoritative grading).
  {
    files: ["src/engine/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react-*",
                "next",
                "next/*",
                "next-intl",
                "next-intl/*",
                "@prisma/client",
                "better-auth",
                "better-auth/*",
                "@/app/*",
                "@/ui/*",
                "@/modules/*",
                "@/lib/*",
                "@/i18n/*",
              ],
              message:
                "src/engine is a pure deterministic library — it must not import app, UI, framework, or database code.",
            },
          ],
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "Date",
          property: "now",
          message: "Engine code must be deterministic — take timestamps as inputs.",
        },
        {
          object: "Math",
          property: "random",
          message: "Engine code must be deterministic — take a seeded RNG as input.",
        },
      ],
    },
  },

  // ── Prisma fence: only the data layer may touch the database client ──
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message:
                "Import the shared client from a module server/ directory via @/lib/db instead.",
            },
            {
              name: "@/lib/db",
              message:
                "Database access is restricted to src/modules/*/server/** (tenant-scoped data layer).",
            },
          ],
        },
      ],
    },
  },
  {
    // The only places allowed to touch Prisma.
    files: [
      "src/modules/**/server/**/*.ts",
      "src/lib/db.ts",
      "src/lib/auth.ts",
      "src/lib/audit.ts",
      "src/lib/events.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];

export default eslintConfig;
