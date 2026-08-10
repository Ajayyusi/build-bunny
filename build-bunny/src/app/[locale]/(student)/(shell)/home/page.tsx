import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { isFeatureEnabled } from "@/modules/shared/features";
import { getMyStudentSnapshot } from "@/modules/students/server/queries";
import { BunnyMascot, EmptyState, StatCard } from "@/ui";

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
      {/* Focal moment: the mascot hops in on load and settles into an idle
          breathing bob. It's the single authored motion beat on this
          surface — everything else is quiet feedback. Positioned as a
          hero panel behind the greeting so the character feels like it's
          saying hi to the student personally. */}
      <div className="relative flex flex-col items-center gap-4 rounded-2xl border border-border-token bg-gradient-to-b from-accent/15 to-transparent px-6 pb-6 pt-8 text-center sm:pt-10">
        <span className="bunny-hop pointer-events-none inline-block [transform-origin:50%_90%]">
          <span className="bunny-idle inline-block text-[88px] leading-none sm:text-[112px]">
            <span aria-hidden="true">🐰</span>
          </span>
        </span>
        <div className="bb-cascade flex flex-col gap-1" style={{ "--i": 1 } as React.CSSProperties}>
          <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
            {t("greeting", { name: displayName })}
          </h1>
          <p className="text-sm text-ink-muted sm:text-base">{t("subtitle")}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bb-cascade" style={{ "--i": 2 } as React.CSSProperties}>
          <StatCard
            label={t("xp")}
            value={snapshot?.xpTotal ?? 0}
            countUp
            icon={<span className="bb-spark text-xl">⚡</span>}
            iconClassName="bg-brand/15"
          />
        </div>
        <div className="bb-cascade" style={{ "--i": 3 } as React.CSSProperties}>
          <StatCard
            label={t("stars")}
            value={snapshot?.starsTotal ?? 0}
            countUp
            icon={<span className="bb-twinkle text-xl">⭐</span>}
            iconClassName="bg-accent/20 text-accent"
          />
        </div>
        <div className="bb-cascade" style={{ "--i": 4 } as React.CSSProperties}>
          <StatCard
            label={t("streak")}
            value={snapshot?.streakCurrent ?? 0}
            countUp
            icon={<span className="bb-flame text-xl">🔥</span>}
            iconClassName="bg-accent/15"
          />
        </div>
      </div>
      {adventureEnabled ? (
        // The map is live for this school — a real link-card, not a
        // promise. The bb-pop class adds a playful lift on hover/tap so
        // the CTA feels touchable to a 9-year-old.
        <Link
          href="/adventure"
          className="bb-pop bb-cascade group flex items-center gap-4 rounded-lg border border-border-token bg-surface-raised p-5 shadow-soft transition-shadow hover:shadow-raised"
          style={{ "--i": 5 } as React.CSSProperties}
        >
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-accent/25 text-2xl"
          >
            <span className="bunny-idle inline-block">🗺️</span>
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
            className="ms-auto size-5 shrink-0 text-ink-muted transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
          >
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        </Link>
      ) : (
        // Honest pre-launch state: no fake "Continue" button while the
        // school's adventure flag is off. The mascot here softens the
        // empty state so it doesn't read as broken.
        <div className="bb-cascade" style={{ "--i": 5 } as React.CSSProperties}>
          <EmptyState
            icon={<BunnyMascot mood="wave" size="md" label={t("emptyTitle")} />}
            title={t("emptyTitle")}
            description={t("emptyBody")}
          />
        </div>
      )}
    </div>
  );
}
