import { PrismaClient } from "@prisma/client";

/**
 * Shared Prisma client. Importable ONLY from src/modules/x/server/** and the
 * whitelisted lib files (ESLint-enforced) — all product reads/writes go
 * through the tenant-scoped data layer, never straight from UI code.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
