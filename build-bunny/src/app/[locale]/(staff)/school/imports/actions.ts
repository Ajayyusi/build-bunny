"use server";

import { z } from "zod";

import { createRateLimiter } from "@/lib/rate-limit";
import { RateLimitedError, withAuth, type ActionResult } from "@/modules/auth/server/guard";
import {
  commitStudentImport,
  dryRunStudentImport,
  type CommitImportResult,
  type ImportPlan,
} from "@/modules/schools/server/imports";

/**
 * 2 MB of CSV text is generous for even a whole-school roster (thousands of
 * rows at ~60 bytes/row) and cheap to bound — the importer loads every row
 * into memory, cross-references it against the whole school's existing
 * students/classes, and (on commit) provisions accounts one row at a time,
 * so an unbounded body is a real memory/DB-load DoS vector, not just
 * theoretical (m5 §34). The client (ImportWizard.tsx) enforces the same
 * ceiling before ever reading the file, but the server never trusts that.
 */
const MAX_CSV_BYTES = 2_000_000;
const csvInput = z.object({
  csvText: z.string().min(1).max(MAX_CSV_BYTES, "CSV file is too large"),
});

/**
 * Anti-hammering guard (m5 §34): each call re-parses the file and re-reads
 * the school's whole student/class roster, so 10/min/admin is generous for
 * the legitimate "upload, fix a typo, re-validate" loop while blocking a
 * scripted hammering of either action.
 */
const importLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

export async function dryRunImportAction(input: unknown): Promise<ActionResult<ImportPlan>> {
  return withAuth("imports:run", csvInput, (ctx, { csvText }) => {
    if (!importLimiter.allow(ctx.userId)) {
      throw new RateLimitedError("Too many import requests");
    }
    return dryRunStudentImport(ctx, csvText);
  })(input);
}

export async function commitImportAction(
  input: unknown,
): Promise<ActionResult<CommitImportResult>> {
  return withAuth("imports:run", csvInput, (ctx, { csvText }) => {
    if (!importLimiter.allow(ctx.userId)) {
      throw new RateLimitedError("Too many import requests");
    }
    return commitStudentImport(ctx, csvText);
  })(input);
}
