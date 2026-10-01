/**
 * What a teacher reads on a Teach-the-bunny attempt (handoff: teacher
 * evidence of "what the student changed"): the examples taught, by label,
 * the cases kept back for testing, the project report, and what changed
 * from the same child's previous try at the level. Pure, from the stored
 * answers only.
 */

export interface AiAttemptAnswer {
  examples?: { id: string; label: "positive" | "negative" }[];
  checkSet?: string[];
  report?: { caseId: string; safeguardId: string };
}

export interface AiAttemptSummary {
  taught: { id: string; label: "positive" | "negative" }[];
  heldBack: string[];
  report: { caseId: string; safeguardId: string } | null;
  /** Null on a first try. */
  changes: { added: string[]; removed: string[]; relabelled: string[] } | null;
}

function parse(value: unknown): AiAttemptAnswer {
  return value && typeof value === "object" ? (value as AiAttemptAnswer) : {};
}

export function summariseAiAttempt(answer: unknown, previous: unknown | null): AiAttemptSummary {
  const now = parse(answer);
  const taught = (now.examples ?? []).filter((e) => typeof e?.id === "string").map((e) => ({ id: e.id, label: e.label }));
  let changes: AiAttemptSummary["changes"] = null;
  if (previous !== null && previous !== undefined) {
    const before = new Map((parse(previous).examples ?? []).map((e) => [e.id, e.label]));
    const after = new Map(taught.map((e) => [e.id, e.label]));
    changes = {
      added: taught.filter((e) => !before.has(e.id)).map((e) => e.id),
      removed: [...before.keys()].filter((id) => !after.has(id)),
      relabelled: taught.filter((e) => before.has(e.id) && before.get(e.id) !== e.label).map((e) => e.id),
    };
  }
  return { taught, heldBack: now.checkSet ?? [], report: now.report ?? null, changes };
}
