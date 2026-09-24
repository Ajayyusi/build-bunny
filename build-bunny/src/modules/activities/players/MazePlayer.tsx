"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type { GridVariantSpec } from "@/engine";
import { Link } from "@/i18n/navigation";
import { PlayerSoundControls } from "@/modules/audio/AudioControls";
import {
  analyzeMazeDesign,
  emptyDesign,
  mazeDraftSchema,
  mazeGridPayload,
} from "@/modules/activities/maze";
import { gridVariantSchema } from "@/modules/curriculum/schemas";
import { BunnyMascot, Button } from "@/ui";

import {
  clearLocalDesign,
  currentDraftVersion,
  readLocalDesign,
  recordDraftVersion,
  stableStringify,
  writeLocalDesign,
} from "./shared/local-draft";
import { GridPlayer } from "./GridPlayer";
import { NextStepHint } from "./shared/NextStepHint";
import { GridScene } from "./shared/GridScene";
import { IntroOverlay } from "./shared/IntroOverlay";
import { MazeDesigner } from "./shared/MazeDesigner";
import type { ActivityPlayerProps, GridActivityPayload, MazeActivityPayload } from "../types";

/**
 * CREATIVE_PROJECT player — build your own maze. Two steps: DESIGN the map
 * (tap tiles, meet the checklist), then BUILD the program on it, which is
 * the ordinary grid player handed a one-variant level made from the child's
 * design. "Change my maze" goes back to the designer with the program kept.
 *
 * Saving: the design and the program travel together in one draft (the
 * grid player wraps every save through `wrapDraft`), plus a per-device
 * mirror of the design so an interrupted tablet resumes the exact map.
 */

type Phase = "intro" | "design" | "build";

/** This device's copy of the design, if it is valid for this board. */
function localDesignFor(
  draft: { playerKey: string; levelId: string },
  board: { width: number; height: number },
): { design: GridVariantSpec; base: string | null } | null {
  const local = readLocalDesign(draft);
  if (!local) return null;
  const parsed = gridVariantSchema.safeParse(local.design);
  if (!parsed.success) return null;
  if (parsed.data.rows.length !== board.height || parsed.data.rows[0]?.length !== board.width) return null;
  return { design: parsed.data, base: local.base };
}

export function MazePlayer({
  intro,
  payload: rawPayload,
  draft,
  revealHintAction,
  nextStepAction,
  saveDraftAction,
}: ActivityPlayerProps) {
  // Registry dispatch guarantees this matches intro.activityType.
  const payload = rawPayload as MazeActivityPayload;
  const t = useTranslations("student.play");
  const rules = useMemo(
    () => ({
      board: payload.board,
      palette: payload.palette,
      mustInclude: payload.mustInclude,
      minGoalHops: payload.minGoalHops,
    }),
    [payload.board, payload.palette, payload.mustInclude, payload.minGoalHops],
  );

  const [design, setDesign] = useState<GridVariantSpec>(
    () => payload.initialDesign ?? emptyDesign(payload.board),
  );
  const designRef = useRef(design);
  designRef.current = design;
  // The program, kept across "Change my maze" round-trips.
  const workspaceRef = useRef<unknown>(payload.initialWorkspace);
  // How many times the child has confirmed a design: remounts the grid
  // player on a new map, never on a re-render.
  const [build, setBuild] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const resumeDraft = payload.initialDesign !== null;

  const draftKey = { playerKey: intro.playerKey, levelId: intro.levelId };

  // Exact resume: this device's copy of the design wins only while the
  // server still holds the draft version it was based on (same rule as the
  // blocks — see local-draft.ts); a design changed on another tablet, or a
  // passed level, wins over it.
  useEffect(() => {
    const local = localDesignFor(draftKey, payload.board);
    if (!local) return;
    if (local.base !== currentDraftVersion(draftKey, intro.draftVersion)) {
      clearLocalDesign(draftKey);
      return;
    }
    if (stableStringify(local.design) !== stableStringify(payload.initialDesign)) setDesign(local.design);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  const issues = useMemo(() => analyzeMazeDesign(rules, design), [rules, design]);
  const ready = issues.length === 0;

  const saveDesign = (next: GridVariantSpec) => {
    const parsed = mazeDraftSchema.safeParse({ design: next, workspaceJson: workspaceRef.current ?? null });
    if (!parsed.success) return;
    // Offline, the save rejects; the design is already mirrored on this device.
    saveDraftAction({ levelId: intro.levelId, workspaceJson: parsed.data })
      .then((result) => {
        const savedAt = result.ok ? (result.data as { savedAt?: unknown } | null)?.savedAt : undefined;
        if (savedAt) recordDraftVersion(draftKey, new Date(savedAt as string | Date).toISOString());
      })
      .catch(() => {});
  };

  const onDesignChange = (next: GridVariantSpec) => {
    setDesign(next);
    writeLocalDesign(draftKey, next, currentDraftVersion(draftKey, intro.draftVersion));
  };

  const startBuilding = () => {
    if (!ready) return;
    saveDesign(design);
    setBuild((n) => n + 1);
    setPhase("build");
  };

  const gridPayload: GridActivityPayload = useMemo(
    () => ({
      ...mazeGridPayload(
        {
          toolbox: payload.toolbox,
          budgets: payload.budgets,
          starCriteria: payload.starCriteria,
          requiredBlocks: payload.requiredBlocks,
        },
        design,
      ),
      initialWorkspace: workspaceRef.current ?? payload.resetWorkspace,
      resetWorkspace: payload.resetWorkspace,
    }),
    // Rebuilt only when a design is confirmed (build), not on every tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [build],
  );

  if (phase === "build") {
    return (
      <GridPlayer
        key={build}
        intro={intro}
        payload={gridPayload}
        draft={draft}
        revealHintAction={revealHintAction}
        nextStepAction={nextStepAction}
        saveDraftAction={saveDraftAction}
        skipIntro
        attemptExtras={{ design }}
        wrapDraft={(json) => ({ design: designRef.current, workspaceJson: json ?? null })}
        onWorkspaceJson={(json) => {
          workspaceRef.current = json;
        }}
        extraAction={{ label: t("maze.edit"), onClick: () => setPhase("design") }}
      />
    );
  }

  return (
    <div className="relative flex h-dvh min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border-token bg-surface-raised px-2 sm:px-4">
        <Link
          href="/adventure"
          aria-label={t("backToMap")}
          className="grid size-11 shrink-0 place-items-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5 rtl:-scale-x-100"
          >
            <path d="M10 3.5 5.5 8 10 12.5" />
          </svg>
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-display text-base font-bold text-ink sm:text-lg">
          {intro.title}
        </h1>
        <PlayerSoundControls />
      </header>

      <section
        aria-label={t("maze.designRegion")}
        className="min-h-0 flex-1 overflow-y-auto bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <div className="flex items-start gap-3 rounded-xl border border-border-token bg-surface-raised p-3">
            <BunnyMascot state={ready ? "excited" : "thinking"} size="sm" />
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-ink">{t("maze.designTitle")}</h2>
              <p className="text-sm text-ink-muted">{t("maze.designBody")}</p>
            </div>
          </div>

          <MazeDesigner rules={rules} design={design} onChange={onDesignChange} issues={issues} theme={intro.worldTheme} />

          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-token bg-surface-raised p-3 shadow-soft">
            <p role="status" className="text-sm font-semibold text-ink">
              {ready ? t("maze.ready") : t("maze.notReady")}
            </p>
            {nextStepAction ? (
              <NextStepHint
                levelId={intro.levelId}
                action={nextStepAction}
                usedBefore={intro.hintsUsedTiers.includes(5)}
                readyAction={`“${t("maze.build")}”`}
                getState={() => ({ design })}
              />
            ) : null}
            <Button size="lg" onClick={startBuilding} disabled={!ready}>
              <span aria-hidden="true">▶</span>
              {t("maze.build")}
            </Button>
          </div>
        </div>
      </section>

      {phase === "intro" ? (
        <IntroOverlay
          title={intro.title}
          story={intro.story}
          objective={intro.objective}
          instructions={intro.instructions}
          difficulty={intro.difficulty}
          estimatedMinutes={intro.estimatedMinutes}
          ageBand={intro.ageBand}
          worldTheme={intro.worldTheme}
          howScene={<GridScene />}
          resumeDraft={resumeDraft}
          onStart={() => {
            if (resumeDraft && ready) {
              // Remount the grid on the design actually on screen (this
              // device's copy may be newer than the server's).
              setBuild((n) => n + 1);
              setPhase("build");
            } else {
              setPhase("design");
            }
          }}
        />
      ) : null}
    </div>
  );
}
