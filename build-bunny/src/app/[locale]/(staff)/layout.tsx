import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { homePathForRole } from "@/modules/auth/roles";
import { requireRole } from "@/modules/auth/server/session";
import { getSchoolSummary } from "@/modules/schools/server/queries";
import { Avatar, SkipLink } from "@/ui";

import { ImpersonationBanner } from "../_components/ImpersonationBanner";
import { LocaleSwitcher } from "../_components/LocaleSwitcher";
import { NavLink } from "../_components/NavLink";
import { SignOutButton } from "../_components/SignOutButton";

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function StaffLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("TEACHER", "SCHOOL_ADMIN");
  const [school, t, tCommon] = await Promise.all([
    getSchoolSummary(ctx),
    getTranslations("staff"),
    getTranslations("common"),
  ]);

  return (
    <div data-theme="pro" className="flex min-h-dvh flex-col bg-surface text-ink">
      <SkipLink label={tCommon("skipToContent")} />
      {ctx.impersonatedBy ? <ImpersonationBanner /> : null}
      <header className="border-b border-border-token bg-surface-raised print:hidden">
        <div className="bb-container flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <Link
              href={homePathForRole(ctx.role)}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md font-display text-lg font-bold text-ink"
            >
              <span aria-hidden>🐰</span>
              {tCommon("appName")}
            </Link>
            <span className="hidden max-w-56 truncate text-sm font-medium text-ink-muted md:inline">
              {school?.name ?? t("header.noSchool")}
            </span>
            <nav aria-label={t("nav.label")} className="flex items-center gap-1">
              <NavLink href="/teach" exact>{t("nav.teach")}</NavLink>
              {ctx.role === "TEACHER" ? (
                <NavLink href="/teach/assignments">{t("nav.assignments")}</NavLink>
              ) : null}
              {ctx.role === "SCHOOL_ADMIN" ? (
                <NavLink href="/school">{t("nav.school")}</NavLink>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <span className="flex items-center gap-2">
              <Avatar displayName={ctx.displayName} size="sm" />
              <span className="hidden text-sm font-semibold md:inline">
                {ctx.displayName}
              </span>
            </span>
            <SignOutButton variant="ghost" size="sm" />
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="bb-container flex-1 py-8 focus:outline-none">
        {children}
      </main>
    </div>
  );
}
