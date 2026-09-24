import "server-only";

import { z } from "zod";

import { db } from "@/lib/db";
import type { SessionContext } from "@/modules/auth/server/session";
import { localizedText, type LocalizedText } from "../schemas";

/**
 * Printable, unplugged worksheets for one module (brief §6 "printables"):
 * the same puzzles the class plays, laid out for paper.
 *
 *  - Block-coding / debugging levels: the board (first variant) with a
 *    legend and numbered lines to write the program on.
 *  - Code-reading levels: the code, the question and the answer choices.
 *  - Ordering levels: the steps in a scrambled order, to be numbered.
 *  - Everything else (AI and creative levels) is listed as "play on the
 *    tablet" — those activities need the live simulation.
 *
 * Read from PUBLISHED snapshots only. Answers are returned because only
 * staff can reach this (teachers and school admins of a school whose
 * programme contains the module); the page prints them on a separate,
 * optional answer-key sheet.
 */

export type WorksheetItem =
  | {
      kind: "grid";
      levelId: string;
      order: number;
      title: LocalizedText;
      mission: LocalizedText | null;
      /** Every board (variant): one program must work on all of them. */
      boards: { rows: string[]; start: { x: number; y: number; dir: "N" | "E" | "S" | "W" } }[];
      blocks: string[];
      /** Lines to print: room for the author's solution plus a margin. */
      lines: number;
      /** Debugging: the broken program to fix. Otherwise any starter blocks. */
      given: OutlineLine[];
      debugging: boolean;
    }
  | {
      kind: "predict";
      levelId: string;
      order: number;
      title: LocalizedText;
      code: string;
      prompt: LocalizedText;
      options: { id: string; text: LocalizedText }[];
      answerId: string;
    }
  | {
      kind: "order";
      levelId: string;
      order: number;
      title: LocalizedText;
      prompt: LocalizedText;
      /** Scrambled for the sheet (never the answer order). */
      items: { id: string; text: LocalizedText }[];
      answer: string[];
    }
  | {
      kind: "screen";
      levelId: string;
      order: number;
      title: LocalizedText;
      mission: LocalizedText | null;
    };

export interface Worksheet {
  moduleId: string;
  moduleName: LocalizedText;
  moduleDescription: LocalizedText | null;
  worldName: LocalizedText;
  /** World theme string — picks what a "C" tile is printed as (collectableGlyph). */
  worldTheme: string;
  items: WorksheetItem[];
}

/** One printed line of a block program, indented by nesting depth. */
export interface OutlineLine {
  depth: number;
  /** Block type, or "else" for the second branch of an if-else. */
  type: string;
  /** The block's number or text field (repeat 3, set counter to 0, say "hi"). */
  value?: string | number;
  /** The condition block plugged into an if. */
  condition?: string;
}

interface JsonBlock {
  type?: unknown;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: JsonBlock } | undefined>;
  next?: { block?: JsonBlock };
}

const VALUE_FIELDS = ["TIMES", "VALUE", "DELTA", "TEXT"] as const;

/**
 * A Blockly workspace (serialized JSON) as printable lines: the main program
 * under "when start", then any trick definition with its body. Pure JSON —
 * no Blockly — so it runs on the server.
 */
export function outlineProgram(workspace: unknown): OutlineLine[] {
  const tops = ((workspace as { blocks?: { blocks?: unknown } } | null)?.blocks?.blocks ?? []) as JsonBlock[];
  if (!Array.isArray(tops)) return [];
  const lines: OutlineLine[] = [];
  const chain = (first: JsonBlock | undefined, depth: number) => {
    for (let block = first; block && typeof block === "object"; block = block.next?.block) {
      if (typeof block.type !== "string") continue;
      const line: OutlineLine = { depth, type: block.type };
      const field = VALUE_FIELDS.map((name) => block.fields?.[name]).find((v) => v !== undefined);
      if (typeof field === "string" || typeof field === "number") line.value = field;
      const condition = block.inputs?.["CONDITION"]?.block?.type;
      if (typeof condition === "string") line.condition = condition;
      lines.push(line);
      chain(block.inputs?.["DO"]?.block, depth + 1);
      if (block.inputs?.["ELSE"]) {
        lines.push({ depth, type: "else" });
        chain(block.inputs["ELSE"]?.block, depth + 1);
      }
    }
  };
  for (const top of tops) if (top?.type === "bb_whenStart") chain(top.next?.block, 0);
  for (const top of tops) {
    if (top?.type === "bb_defineTrick") {
      lines.push({ depth: 0, type: "bb_defineTrick" });
      chain(top.inputs?.["DO"]?.block, 1);
    }
  }
  return lines;
}

const baseSnapshot = z
  .object({
    title: localizedText,
    mission: localizedText.nullish(),
    payload: z.unknown(),
  })
  .passthrough();

const gridPayload = z
  .object({
    toolbox: z.array(z.object({ type: z.string() }).passthrough()),
    variants: z
      .array(
        z.object({
          rows: z.array(z.string()).min(1),
          start: z.object({ x: z.number().int(), y: z.number().int(), dir: z.enum(["N", "E", "S", "W"]) }),
        }),
      )
      .min(1),
  })
  .passthrough();

const predictPayload = z
  .object({
    code: z.string(),
    prompt: localizedText,
    options: z.array(z.object({ id: z.string(), text: localizedText })),
    correctOptionId: z.string(),
  })
  .passthrough();

const orderPayload = z
  .object({
    prompt: localizedText,
    items: z.array(z.object({ id: z.string(), text: localizedText })),
    correctOrder: z.array(z.string()),
  })
  .passthrough();

/**
 * A fixed scramble in which NO step sits in its answer position (a
 * derangement), so the printed order gives nothing away and the same sheet
 * prints every time. Each swap below removes a step from its answer
 * position without putting another one into its own, so the loop ends.
 */
export function scramble<T extends { id: string }>(items: T[], answer: string[]): T[] {
  const key = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const out = [...items].sort((a, b) => key(a.id) - key(b.id) || a.id.localeCompare(b.id));
  if (out.length < 2) return out;
  for (;;) {
    const i = out.findIndex((item, index) => item.id === answer[index]);
    if (i < 0) return out;
    const j = (i + 1) % out.length;
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
}

const MIN_PROGRAM_LINES = 8;

export async function getModuleWorksheet(
  ctx: SessionContext,
  moduleId: string,
): Promise<Worksheet | null> {
  const schoolId = ctx.schoolId;
  if (!schoolId) return null;
  if (ctx.role !== "TEACHER" && ctx.role !== "SCHOOL_ADMIN") return null;

  const mod = await db.module.findFirst({
    where: {
      id: moduleId,
      world: {
        status: "PUBLISHED",
        horizon: false,
        // The module must belong to a programme this school has switched on.
        programs: { some: { program: { schoolPrograms: { some: { schoolId } } } } },
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
      world: { select: { name: true, theme: true } },
      levels: {
        where: { status: "PUBLISHED", publishedVersionId: { not: null } },
        orderBy: { order: "asc" },
        select: { id: true, order: true, activityType: true, publishedVersionId: true },
      },
    },
  });
  if (!mod) return null;

  const versions = await db.levelVersion.findMany({
    where: { id: { in: mod.levels.map((l) => l.publishedVersionId as string) } },
    select: { id: true, snapshot: true },
  });
  const snapshotById = new Map(versions.map((v) => [v.id, v.snapshot]));

  const items: WorksheetItem[] = mod.levels.flatMap((level): WorksheetItem[] => {
    const base = baseSnapshot.safeParse(snapshotById.get(level.publishedVersionId as string));
    if (!base.success) return [];
    const common = { levelId: level.id, order: level.order, title: base.data.title };
    const mission = base.data.mission ?? null;

    if (level.activityType === "BLOCK_CODING" || level.activityType === "DEBUGGING") {
      const grid = gridPayload.safeParse(base.data.payload);
      if (grid.success) {
        const debugging = level.activityType === "DEBUGGING";
        const payload = base.data.payload as {
          brokenWorkspace?: unknown;
          startWorkspace?: unknown;
          solution?: unknown;
        };
        return [
          {
            kind: "grid",
            ...common,
            mission,
            boards: grid.data.variants.map((v) => ({ rows: v.rows, start: v.start })),
            blocks: [...new Set(grid.data.toolbox.map((b) => b.type))],
            // Only the solution's LENGTH is used — never its blocks.
            lines: Math.max(MIN_PROGRAM_LINES, outlineProgram(payload.solution).length + 2),
            given: outlineProgram(debugging ? payload.brokenWorkspace : payload.startWorkspace),
            debugging,
          },
        ];
      }
    }
    if (level.activityType === "CODE_PREDICTION") {
      const p = predictPayload.safeParse(base.data.payload);
      if (p.success) {
        return [
          {
            kind: "predict",
            ...common,
            code: p.data.code,
            prompt: p.data.prompt,
            options: p.data.options,
            answerId: p.data.correctOptionId,
          },
        ];
      }
    }
    if (level.activityType === "SEQUENCING") {
      const s = orderPayload.safeParse(base.data.payload);
      if (s.success) {
        return [
          {
            kind: "order",
            ...common,
            prompt: s.data.prompt,
            items: scramble(s.data.items, s.data.correctOrder),
            answer: s.data.correctOrder,
          },
        ];
      }
    }
    return [{ kind: "screen", ...common, mission }];
  });

  const text = localizedText.nullish();
  const name = localizedText.safeParse(mod.name);
  const worldName = localizedText.safeParse(mod.world.name);
  const description = text.safeParse(mod.description);
  return {
    moduleId: mod.id,
    moduleName: name.success ? name.data : { en: "" },
    moduleDescription: description.success ? (description.data ?? null) : null,
    worldName: worldName.success ? worldName.data : { en: "" },
    worldTheme: mod.world.theme,
    items,
  };
}
