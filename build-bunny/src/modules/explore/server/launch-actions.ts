"use server";

import { z } from "zod";

import { withAuth, type ActionResult } from "@/modules/auth/server/guard";

import { launchExploreActivityCore, setExploreActivityOpenCore, stopExploreLaunchCore } from "./launch";

const classId = z.string().min(1).max(64);
const slug = z.string().regex(/^[a-z0-9-]+$/).max(80);

/** A class teacher switches an Explore AI activity on or off (assignments:manage). */
export async function setExploreActivityOpenAction(raw: unknown): Promise<ActionResult<{ open: boolean }>> {
  return withAuth("assignments:manage", z.object({ classId, slug, open: z.boolean() }), (ctx, data) =>
    setExploreActivityOpenCore(ctx, data),
  )(raw);
}

/** A class teacher launches one activity as "Today's AI activity". */
export async function launchExploreActivityAction(raw: unknown): Promise<ActionResult<{ launched: string }>> {
  return withAuth("assignments:manage", z.object({ classId, slug }), (ctx, data) => launchExploreActivityCore(ctx, data))(raw);
}

/** A class teacher stops the launch. */
export async function stopExploreLaunchAction(raw: unknown): Promise<ActionResult<{ launched: null }>> {
  return withAuth("assignments:manage", z.object({ classId }), (ctx, data) => stopExploreLaunchCore(ctx, data))(raw);
}
