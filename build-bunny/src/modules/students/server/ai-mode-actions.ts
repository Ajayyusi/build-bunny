"use server";

import { z } from "zod";

import { withAuth, type ActionResult } from "@/modules/auth/server/guard";

import type { AiModeChoice } from "../ai-mode";
import { setMyAiModeCore, setStudentAiModeCore } from "./ai-mode";

const choice = z.enum(["younger", "older", "auto"]);

/** The child's own switch (they hold attempts:submit). */
export async function setMyAiModeAction(raw: unknown): Promise<ActionResult<{ choice: AiModeChoice }>> {
  return withAuth("attempts:submit", z.object({ choice }), (ctx, { choice: c }) => setMyAiModeCore(ctx, c))(raw);
}

/** A teacher or school admin, for a child in their scope (attempts:feedback). */
export async function setStudentAiModeAction(raw: unknown): Promise<ActionResult<{ choice: AiModeChoice }>> {
  return withAuth(
    "attempts:feedback",
    z.object({ studentUserId: z.string().min(1), choice }),
    (ctx, data) => setStudentAiModeCore(ctx, data),
  )(raw);
}
