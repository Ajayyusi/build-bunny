import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { homePathForRole } from "@/modules/auth/roles";
import { requireRole } from "@/modules/auth/server/session";
import { getLicenceNotice, getSchoolSummary } from "@/modules/schools/server/queries";
import { Avatar, SkipLink } from "@/ui";
import { BrandLockup } from "@/ui/BrandLogo";
import { schoolFontVariable } from "@/ui/fonts";

import { ImpersonationBanner } from "../_components/ImpersonationBanner";
import { LicenceBanner } from "./_components/LicenceBanner";
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
  const [school, licenceNotice, t, tCommon] = await Promise.all([
    getSchoolSummary(ctx),
    // Only the role that can renew a licence is told about it; a teacher can
    // do nothing with this and would just be alarmed on every page.
    ctx.role === "SCHOOL_ADMIN" ? getLicenceNotice(ctx) : Promise.resolve(null),
    getTranslations("staff"),
    getTranslations("common"),
  ]);

  return (
    <div
      data-theme="pro"
      className={`flex min-h-dvh flex-col bg-surface text-ink ${schoolFontVariable(locale as Locale)}`}
    >
      <SkipLink label={tCommon("skipToContent")} />
      {ctx.impersonatedBy ? <ImpersonationBanner /> : null}
      {/* Only for the role that can act on it — see LicenceBanner. Resolved
          here so it appears on every school-admin page, not just the one
          they happen to open after the licence has already lapsed. */}
      {licenceNotice ? <LicenceBanner notice={licenceNotice} /> : null}
      <header className="border-b border-border-token bg-surface-raised print:hidden">
        <div className="bb-container flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <Link
              href={homePathForRole(ctx.role)}
              className="inline-flex h-11 shrink-0 items-center rounded-md"
            >
              <BrandLockup byLabel={tCommon("byNitaq")} />
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
