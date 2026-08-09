import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { getAttemptReplay } from "@/modules/analytics/server/queries";
import { resolveText } from "@/modules/curriculum/schemas";
import { Badge, ErrorState, PageHeader, StatCard } from "@/ui";

import { ReplayViewer } from "./_components/ReplayViewer";

interface Props {
  params: Promise<{ locale: string; attemptId: string }>;
}

const VERDICT_VARIANT = {
  PASS: "positive",
  PARTIAL: "warning",
  FAIL: "danger",
  ERROR: "danger",
} as const;

export default async function AttemptReplayPage({ params }: Props) {
  const { locale, attemptId } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("TEACHER", "SCHOOL_ADMIN");
  const [replay, t, tStudent] = await Promise.all([
    getAttemptReplay(ctx, attemptId),
    getTranslations("staff.teach.replay"),
    getTranslations("staff.teach.student"),
  ]);

  if (!replay) {
    return (
      <ErrorState title={t("notFoundTitle")} description={t("notFoundBody")} className="my-8" />
    );
  }

  const { attempt } = replay;
  const levelTitle = resolveText(attempt.levelTitle, locale);
  const durationLabel =
    attempt.durationMs === null
      ? "—"
      : `${Math.floor(attempt.durationMs / 60_000)}m ${Math.round((attempt.durationMs % 60_000) / 1000)}s`;

  return (
    <div className="flex flex-col gap-6">
      {attempt.classId ? (
        <Link
          href={`/teach/classes/${attempt.classId}/students/${attempt.studentUserId}`}
          className="w-fit text-sm font-semibold text-brand hover:underline"
        >
          {t("backLink")}
        </Link>
      ) : null}
      <PageHeader
        title={t("title")}
        description={t("meta", { student: attempt.studentDisplayName, level: levelTitle })}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={VERDICT_VARIANT[attempt.verdict]}>{attempt.verdict}</Badge>
            <Badge variant="accent">★{attempt.starsEarned}</Badge>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={tStudent("header.xp")} value={`+${attempt.xpAwarded}`} />
        <StatCard label={tStudent("attempts.hints")} value={attempt.hintTierUsed || "—"} />
        <StatCard label={tStudent("attempts.duration")} value={<span dir="ltr">{durationLabel}</span>} />
        <StatCard label={tStudent("attempts.blocks")} value={attempt.blockCount ?? "—"} />
      </div>
      <ReplayViewer
        attempt={{
          verdict: attempt.verdict,
          starsEarned: attempt.starsEarned,
          xpAwarded: attempt.xpAwarded,
          hintTierUsed: attempt.hintTierUsed,
          durationMs: attempt.durationMs,
          blockCount: attempt.blockCount,
          activityType: attempt.activityType,
          worldTheme: attempt.worldTheme,
        }}
        workspaceJson={replay.workspaceJson}
        generatedCode={replay.generatedCode}
        levelPayload={replay.levelPayload}
        runs={replay.runs}
        perVariant={replay.perVariant}
      />
    </div>
  );
}
