import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { isFeatureEnabled } from "@/modules/shared/features";
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
  const adventureEnabled = isFeatureEnabled(
    snapshot?.school.features,
    "adventure",
  );

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
      {adventureEnabled ? (
        // The map is live for this school — a real link-card, not a promise.
        // "Continue learning" (deep link into the current level) arrives with
        // the M3 player.
        <Link
          href="/adventure"
          className="group flex items-center gap-4 rounded-lg border border-border-token bg-surface-raised p-5 shadow-soft transition-shadow hover:shadow-raised"
        >
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-accent/25 text-2xl"
          >
            🗺️
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-display text-base font-bold text-ink">
              {t("adventureCardTitle")}
            </span>
            <span className="text-sm text-ink-muted">
              {t("adventureCardBody")}
            </span>
            <span className="mt-1 text-sm font-semibold text-brand">
              {t("adventureCardCta")}
            </span>
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ms-auto size-5 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
          >
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        </Link>
      ) : (
        // Honest pre-launch state: no fake "Continue" button while the
        // school's adventure flag is off.
        <EmptyState
          icon={<span className="text-2xl">🗺️</span>}
          title={t("emptyTitle")}
          description={t("emptyBody")}
        />
      )}
    </div>
  );
}
