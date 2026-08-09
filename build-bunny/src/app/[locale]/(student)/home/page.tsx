import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { getMyStudentSnapshot } from "@/modules/students/server/queries";
import { EmptyState, PageHeader, StatCard } from "@/ui";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function StudentHomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("STUDENT");
  const [snapshot, t] = await Promise.all([
    getMyStudentSnapshot(ctx),
    getTranslations("student.home"),
  ]);
  const displayName = snapshot?.user.displayName ?? ctx.displayName;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("greeting", { name: displayName })}
        description={t("subtitle")}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("xp")}
          value={snapshot?.xpTotal ?? 0}
          icon={<span className="text-xl">⚡</span>}
        />
        <StatCard
          label={t("stars")}
          value={snapshot?.starsTotal ?? 0}
          icon={<span className="text-xl">⭐</span>}
        />
        <StatCard
          label={t("streak")}
          value={snapshot?.streakCurrent ?? 0}
          icon={<span className="text-xl">🔥</span>}
        />
      </div>
      {/* Honest pre-curriculum state: the adventure map ships in its own
          milestone, so there is no fake "Continue" button here. */}
      <EmptyState
        icon={<span className="text-2xl">🗺️</span>}
        title={t("emptyTitle")}
        description={t("emptyBody")}
      />
    </div>
  );
}
