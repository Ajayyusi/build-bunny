"use client";

import { useTranslations } from "next-intl";

import { summariseAiAttempt } from "@/modules/ai/attempt-summary";
import { resolveText, type LocalizedText } from "@/modules/curriculum/schemas";
import { Card, CardBody, CardHeader, CardTitle } from "@/ui";

interface Payload {
  labels?: { positive: LocalizedText; negative: LocalizedText };
  pool?: { id: string; size: number; color: number }[];
  theme?: { featureNames?: { size: LocalizedText; color: LocalizedText } };
  report?: { safeguards?: { id: string; text: LocalizedText }[] };
}

/**
 * A Teach-the-bunny attempt for the teacher: what the child taught it, with
 * which label, what they kept back for testing, their project report, and
 * what changed since their previous try.
 */
export function AiAttemptReplay({
  levelPayload,
  workspaceJson,
  previousWorkspaceJson,
  locale,
}: {
  levelPayload: unknown;
  workspaceJson: unknown;
  previousWorkspaceJson: unknown | null;
  locale: string;
}) {
  const t = useTranslations("staff.teach.replay.ai");
  const payload = (levelPayload ?? {}) as Payload;
  const summary = summariseAiAttempt(workspaceJson, previousWorkspaceJson);
  const pool = new Map((payload.pool ?? []).map((s) => [s.id, s]));
  const sizeName = resolveText(payload.theme?.featureNames?.size, locale) || t("size");
  const colorName = resolveText(payload.theme?.featureNames?.color, locale) || t("colour");
  const describe = (id: string) => {
    const s = pool.get(id);
    return s
      ? t("specimen", { sizeName, size: Math.round(s.size * 10), colorName, color: Math.round(s.color * 10) })
      : id;
  };
  const label = (which: "positive" | "negative") => resolveText(payload.labels?.[which], locale) || which;
  const safeguard = (id: string) => resolveText(payload.report?.safeguards?.find((s) => s.id === id)?.text, locale) || id;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("heading")}</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          {(["positive", "negative"] as const).map((which) => {
            const taught = summary.taught.filter((e) => e.label === which);
            return (
              <div key={which} className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-ink-muted">{t("taughtAs", { label: label(which), count: taught.length })}</span>
                <ul className="flex list-disc flex-col gap-0.5 ps-5 text-ink">
                  {taught.map((e) => (
                    <li key={e.id}>{describe(e.id)}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        {summary.heldBack.length > 0 ? <p className="text-ink">{t("heldBack", { count: summary.heldBack.length })}</p> : null}
        {summary.report ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-muted">{t("reportHeading")}</span>
            <p className="text-ink">{t("reportCase", { item: describe(summary.report.caseId) })}</p>
            <p className="text-ink">{t("reportSafeguard", { safeguard: safeguard(summary.report.safeguardId) })}</p>
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-ink-muted">{t("changedHeading")}</span>
          {summary.changes === null ? (
            <p className="text-ink">{t("firstTry")}</p>
          ) : summary.changes.added.length + summary.changes.removed.length + summary.changes.relabelled.length === 0 ? (
            <p className="text-ink">{t("noChange")}</p>
          ) : (
            <ul className="flex list-disc flex-col gap-0.5 ps-5 text-ink">
              {summary.changes.added.map((id) => (
                <li key={`a-${id}`}>{t("added", { item: describe(id) })}</li>
              ))}
              {summary.changes.removed.map((id) => (
                <li key={`r-${id}`}>{t("removed", { item: describe(id) })}</li>
              ))}
              {summary.changes.relabelled.map((id) => (
                <li key={`l-${id}`}>{t("relabelled", { item: describe(id) })}</li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
