"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { ProgramRun } from "@/modules/blockly/interpreter";
import { CodeView } from "@/modules/blockly/CodeView";
import { useFeedbackText } from "@/modules/activities/players/shared/ResultBanner";
import { blockCodingPayload, resolveText, type LocalizedText } from "@/modules/curriculum/schemas";
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, cn } from "@/ui";

// Blockly renders into a real DOM — client-only by contract, read-only here.
const BlocklyWorkspace = dynamic(() => import("@/modules/blockly/BlocklyWorkspace"), {
  ssr: false,
});
const SimulationCanvas = dynamic(() => import("@/modules/simulation/SimulationCanvas"), {
  ssr: false,
});

const GRID_TYPES = new Set(["BLOCK_CODING", "DEBUGGING"]);

export interface ReplayCheckFailureVM {
  code: string;
  data?: Record<string, unknown>;
}
export interface ReplayVariantResultVM {
  checkFailures: ReplayCheckFailureVM[];
  termination: string;
  collected: number;
  commandCount: number;
}

export interface ReplayViewerProps {
  attempt: {
    verdict: "PASS" | "PARTIAL" | "FAIL" | "ERROR";
    starsEarned: number;
    xpAwarded: number;
    hintTierUsed: number;
    durationMs: number | null;
    blockCount: number | null;
    activityType: string;
    worldTheme: string;
  };
  workspaceJson: unknown;
  generatedCode: string;
  levelPayload: unknown;
  runs: ProgramRun[];
  perVariant: ReplayVariantResultVM[];
}

/**
 * Deterministic replay (m4 deliverable 5): the workspace/answer, generated
 * code and simulation runs were ALREADY re-computed server-side by
 * getAttemptReplay — this component is a pure, read-only viewer of that
 * result. Non-grid activity types (CODE_PREDICTION/SEQUENCING) have no code
 * or simulation, so they fall back to a plain answer review.
 */
export function ReplayViewer({
  attempt,
  workspaceJson,
  generatedCode,
  levelPayload,
  runs,
  perVariant,
}: ReplayViewerProps) {
  const t = useTranslations("staff.teach.replay");
  const locale = useLocale();

  if (!GRID_TYPES.has(attempt.activityType)) {
    return <AnswerReplay activityType={attempt.activityType} levelPayload={levelPayload} workspaceJson={workspaceJson} locale={locale} />;
  }

  const parsedPayload = blockCodingPayload.safeParse(levelPayload);
  const toolbox = parsedPayload.success ? parsedPayload.data.toolbox : [];
  const variants = parsedPayload.success ? parsedPayload.data.variants : [];

  return (
    <GridReplay
      toolbox={toolbox}
      variants={variants}
      worldTheme={attempt.worldTheme}
      workspaceJson={workspaceJson}
      generatedCode={generatedCode}
      runs={runs}
      perVariant={perVariant}
      t={t}
      locale={locale}
    />
  );
}

type ReplayT = ReturnType<typeof useTranslations<"staff.teach.replay">>;

function GridReplay({
  toolbox,
  variants,
  worldTheme,
  workspaceJson,
  generatedCode,
  runs,
  perVariant,
  t,
  locale,
}: {
  toolbox: { type: string; limit?: number }[];
  variants: { rows: string[]; start: { x: number; y: number; dir: "N" | "E" | "S" | "W" } }[];
  worldTheme: string;
  workspaceJson: unknown;
  generatedCode: string;
  runs: ProgramRun[];
  perVariant: ReplayVariantResultVM[];
  t: ReplayT;
  locale: string;
}) {
  const [variantIndex, setVariantIndex] = useState(0);
  const [view, setView] = useState<"blocks" | "code">("blocks");
  const [playing, setPlaying] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const feedbackText = useFeedbackText();

  const variant = variants[variantIndex];
  const run = runs[variantIndex] ?? null;
  const result = perVariant[variantIndex];

  const workspacePayload = useMemo(() => ({ toolbox, startWorkspace: workspaceJson }), [toolbox, workspaceJson]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>{t("playbackHeading")}</CardTitle>
            {variants.length > 1 ? (
              <div className="flex gap-1">
                {variants.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-pressed={index === variantIndex}
                    aria-label={t("variantLabel", { current: index + 1, total: variants.length })}
                    onClick={() => {
                      setVariantIndex(index);
                      setPlaying(false);
                    }}
                    className={cn(
                      "flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-bold transition-colors",
                      index === variantIndex
                        ? "bg-brand/10 text-brand underline decoration-2 underline-offset-4"
                        : "text-ink-muted hover:bg-surface-sunken",
                    )}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            ) : null}
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            {variant ? (
              <div className="h-64 overflow-hidden rounded-lg border border-border-token">
                <SimulationCanvas
                  variant={variant}
                  theme={worldTheme}
                  run={run}
                  playing={playing}
                  onPlaybackEnd={() => setPlaying(false)}
                  onStepChange={(_, blockId) => setHighlightId(blockId)}
                  reducedMotion={false}
                  ariaLabel={t("playbackHeading")}
                />
              </div>
            ) : null}
            <Button variant="secondary" onClick={() => setPlaying(true)} disabled={!run || playing}>
              <span aria-hidden="true">▶</span>
              {playing ? t("play") : t("replay")}
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>{view === "blocks" ? t("runLabel") : t("codeHeading")}</CardTitle>
            <div className="flex h-9 items-center gap-1 rounded-lg border border-border-token bg-surface-sunken p-1">
              <button
                type="button"
                aria-pressed={view === "blocks"}
                onClick={() => setView("blocks")}
                className={cn(
                  "h-7 rounded-md px-2.5 text-xs font-semibold transition-colors",
                  view === "blocks" ? "bg-surface-raised text-ink shadow-soft" : "text-ink-muted",
                )}
              >
                {t("runLabel")}
              </button>
              <button
                type="button"
                aria-pressed={view === "code"}
                onClick={() => setView("code")}
                className={cn(
                  "h-7 rounded-md px-2.5 text-xs font-semibold transition-colors",
                  view === "code" ? "bg-surface-raised text-ink shadow-soft" : "text-ink-muted",
                )}
              >
                {t("codeHeading")}
              </button>
            </div>
          </CardHeader>
          <CardBody className="h-64 overflow-auto p-2">
            {view === "blocks" ? (
              <BlocklyWorkspace
                payload={workspacePayload}
                initialWorkspaceJson={workspaceJson}
                locale={locale === "ar" ? "ar" : "en"}
                rtl={locale === "ar"}
                readOnly
                onChange={() => {}}
                highlightBlockId={highlightId}
              />
            ) : (
              <CodeView code={generatedCode} />
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("checksHeading")}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-2">
          {result && result.checkFailures.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {result.checkFailures.map((failure, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Badge variant="danger">{t("checkFailed")}</Badge>
                  <span className="text-ink">{feedbackText(failure)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-ink">
              <Badge variant="positive">{t("checkPassed")}</Badge>
              {t("noFeedback")}
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function AnswerReplay({
  activityType,
  levelPayload,
  workspaceJson,
  locale,
}: {
  activityType: string;
  levelPayload: unknown;
  workspaceJson: unknown;
  locale: string;
}) {
  const t = useTranslations("staff.teach.replay");

  if (activityType === "CODE_PREDICTION" && levelPayload && typeof levelPayload === "object") {
    const payload = levelPayload as {
      code?: string;
      prompt?: LocalizedText;
      options?: { id: string; text: LocalizedText }[];
      correctOptionId?: string;
    };
    const chosen = (workspaceJson as { optionId?: string } | null)?.optionId ?? null;
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("codeHeading")}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-3">
          {payload.code ? <CodeView code={payload.code} /> : null}
          {payload.prompt ? <p className="text-sm text-ink">{resolveText(payload.prompt, locale)}</p> : null}
          <ul className="flex flex-col gap-1.5">
            {(payload.options ?? []).map((option) => (
              <li
                key={option.id}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                  option.id === payload.correctOptionId
                    ? "border-positive/40 bg-positive/8"
                    : option.id === chosen
                      ? "border-danger/40 bg-danger/8"
                      : "border-border-token",
                )}
              >
                {option.id === chosen ? <Badge variant="brand">{t("runLabel")}</Badge> : null}
                <span className="text-ink">{resolveText(option.text, locale)}</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    );
  }

  if (activityType === "SEQUENCING" && levelPayload && typeof levelPayload === "object") {
    const payload = levelPayload as {
      items?: { id: string; text: LocalizedText }[];
      correctOrder?: string[];
    };
    const submitted = (workspaceJson as { order?: string[] } | null)?.order ?? [];
    const byId = new Map((payload.items ?? []).map((item) => [item.id, item.text]));
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("checksHeading")}</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-muted">{t("runLabel")}</span>
            <ol className="flex list-decimal flex-col gap-1 ps-5 text-sm text-ink">
              {submitted.map((id) => (
                <li key={id}>{resolveText(byId.get(id), locale) || id}</li>
              ))}
            </ol>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-muted">{t("checkPassed")}</span>
            <ol className="flex list-decimal flex-col gap-1 ps-5 text-sm text-ink">
              {(payload.correctOrder ?? []).map((id) => (
                <li key={id}>{resolveText(byId.get(id), locale) || id}</li>
              ))}
            </ol>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <p className="text-sm text-ink-muted">{t("noFeedback")}</p>
      </CardBody>
    </Card>
  );
}
