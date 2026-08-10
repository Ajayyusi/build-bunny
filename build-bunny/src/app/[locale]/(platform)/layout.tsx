import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { requireRole } from "@/modules/auth/server/session";
import { Avatar, SkipLink } from "@/ui";

import { ImpersonationBanner } from "../_components/ImpersonationBanner";
import { LocaleSwitcher } from "../_components/LocaleSwitcher";
import { NavLink } from "../_components/NavLink";
import { SignOutButton } from "../_components/SignOutButton";

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function PlatformLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("SUPER_ADMIN", "NITAQ_ADMIN");
  const [t, tCommon] = await Promise.all([
    getTranslations("platform"),
    getTranslations("common"),
  ]);

  return (
    <div data-theme="pro" className="flex min-h-dvh flex-col bg-surface text-ink">
      <SkipLink label={tCommon("skipToContent")} />
      {ctx.impersonatedBy ? <ImpersonationBanner /> : null}
      {/* Brand-colored bottom rule distinguishes the platform bar from the
          school staff bar at a glance. */}
      <header className="border-b-2 border-b-brand bg-surface-raised">
        <div className="bb-container flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <Link
              href="/nitaq"
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md font-display text-lg font-bold text-ink"
            >
              <span aria-hidden>🐰</span>
              {t("title")}
            </Link>
            <nav aria-label={t("nav.label")} className="flex items-center gap-1">
              <NavLink href="/nitaq/schools">{t("nav.schools")}</NavLink>
              <NavLink href="/nitaq/users">{t("nav.users")}</NavLink>
              <NavLink href="/nitaq/curriculum">{t("nav.curriculum")}</NavLink>
              <NavLink href="/nitaq/audit-log">{t("nav.auditLog")}</NavLink>
              <NavLink href="/nitaq/certificates">{t("nav.certificates")}</NavLink>
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
