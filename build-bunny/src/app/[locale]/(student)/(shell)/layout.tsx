import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { isFeatureEnabled } from "@/modules/shared/features";
import { getMyStudentSnapshot } from "@/modules/students/server/queries";
import { Avatar } from "@/ui";

import { NavLink } from "../../_components/NavLink";

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Student chrome (header + nav + page container) for the browsing surfaces:
 * home, adventure map, profile. The play route lives in the (immersive)
 * sibling group and renders without any of this. requireRole is
 * request-cached, so re-deriving ctx here costs nothing.
 */
export default async function StudentShellLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("STUDENT");
  const [snapshot, t, tCommon] = await Promise.all([
    getMyStudentSnapshot(ctx),
    getTranslations("student"),
    getTranslations("common"),
  ]);
  const displayName = snapshot?.user.displayName ?? ctx.displayName;
  // No dead nav: the Adventure item exists only when the school's flag is on
  // (m2 §flags) — the /adventure page enforces the same check server-side.
  const adventureEnabled = isFeatureEnabled(
    snapshot?.school.features,
    "adventure",
  );

  return (
    <>
      <header className="border-b border-border-token bg-surface-raised">
        <div className="bb-container flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link
              href="/home"
              className="inline-flex h-11 items-center gap-2 rounded-md font-display text-lg font-bold text-ink"
            >
              <span aria-hidden>🐰</span>
              {tCommon("appName")}
            </Link>
            <nav aria-label={t("nav.label")} className="flex items-center gap-1">
              <NavLink href="/home">{t("nav.home")}</NavLink>
              {adventureEnabled ? (
                <NavLink href="/adventure">{t("nav.adventure")}</NavLink>
              ) : null}
              <NavLink href="/profile">{t("nav.profile")}</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 items-center gap-1 rounded-full bg-accent/25 px-3 text-sm font-bold tabular-nums">
              <span aria-hidden>⚡</span>
              <span className="sr-only">{t("header.xpLabel")}: </span>
              {t("header.xpChip", { value: String(snapshot?.xpTotal ?? 0) })}
            </span>
            <span className="inline-flex h-9 items-center gap-1 rounded-full bg-accent/25 px-3 text-sm font-bold tabular-nums">
              <span aria-hidden>⭐</span>
              <span className="sr-only">{t("header.starsLabel")}: </span>
              {snapshot?.starsTotal ?? 0}
            </span>
            <span className="flex items-center gap-2">
              <Avatar displayName={displayName} size="md" />
              <span className="hidden text-sm font-semibold sm:inline">
                {displayName}
              </span>
            </span>
          </div>
        </div>
      </header>
      <main className="bb-container flex-1 py-8">{children}</main>
    </>
  );
}
