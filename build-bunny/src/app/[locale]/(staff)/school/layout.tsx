import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";

import { NavLink } from "../../_components/NavLink";

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Sub-navigation shared by every /school/* management page. A dedicated
 * layout (rather than repeating the tab bar per page) keeps the section
 * feeling like one connected surface instead of six disconnected screens.
 */
export default async function SchoolSectionLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("SCHOOL_ADMIN");
  const t = await getTranslations("staff.school.nav");

  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label={t("label")}
        className="flex flex-wrap items-center gap-1 border-b border-border-token pb-1 print:hidden"
      >
        <NavLink href="/school" exact>{t("overview")}</NavLink>
        <NavLink href="/school/teachers">{t("teachers")}</NavLink>
        <NavLink href="/school/students">{t("students")}</NavLink>
        <NavLink href="/school/classes">{t("classes")}</NavLink>
        <NavLink href="/school/imports">{t("imports")}</NavLink>
        <NavLink href="/school/certificates">{t("certificates")}</NavLink>
        <NavLink href="/school/reports">{t("reports")}</NavLink>
        <NavLink href="/school/activity">{t("activity")}</NavLink>
        <NavLink href="/school/privacy">{t("privacy")}</NavLink>
      </nav>
      {children}
    </div>
  );
}
