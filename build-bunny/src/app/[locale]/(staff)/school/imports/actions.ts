"use server";

import { z } from "zod";

import { withAuth, type ActionResult } from "@/modules/auth/server/guard";
import {
  commitStudentImport,
  dryRunStudentImport,
  type CommitImportResult,
  type ImportPlan,
} from "@/modules/schools/server/imports";

const csvInput = z.object({ csvText: z.string().min(1) });

export async function dryRunImportAction(input: unknown): Promise<ActionResult<ImportPlan>> {
  return withAuth("imports:run", csvInput, (ctx, { csvText }) =>
    dryRunStudentImport(ctx, csvText),
  )(input);
}

export async function commitImportAction(
  input: unknown,
): Promise<ActionResult<CommitImportResult>> {
  return withAuth("imports:run", csvInput, (ctx, { csvText }) =>
    commitStudentImport(ctx, csvText),
  )(input);
}
