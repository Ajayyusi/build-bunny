import { getTranslations, setRequestLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { homePathForRole } from "@/modules/auth/roles";
import { getSessionContext } from "@/modules/auth/server/session";

import { AuthShell } from "../_components/AuthShell";

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * Where a blocked school lands.
 *
 * Deliberately does NOT go through requireRole: that guard is what redirects
 * here, so using it would loop. It reads the session directly and re-checks
 * entitlement itself, sending anyone whose access is fine back to their own
 * home so the page cannot be used as a dead end by a working account.
 *
 * The copy is aimed at the adult who can fix it and never blames the child —
 * a pupil who opens this has done nothing wrong, and the fix is a
 * conversation between their school and NITAQ.
 */
export default async function LicenceBlockedPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getSessionContext();
  if (!ctx) {
    redirect({ href: "/login", locale });
    return null;
  }
  if (ctx.entitlement.canAccess) {
    redirect({ href: homePathForRole(ctx.role), locale });
    return null;
  }

  const t = await getTranslations("auth.licence");
  const isStudent = ctx.role === "STUDENT";
  const state = ctx.entitlement.state;
  // Students get one gentle line; staff get the state and what to do.
  const body = isStudent
    ? t("studentBody")
    : t(`states.${state === "SCHOOL_INACTIVE" ? "SCHOOL_INACTIVE" : state}`);

  return (
    <AuthShell theme={isStudent ? "play" : "pro"} title={isStudent ? t("studentTitle") : t("title")}>
      <p className="text-sm leading-relaxed text-ink-muted">{body}</p>
      {isStudent ? null : (
        <p className="text-sm leading-relaxed text-ink-muted">{t("staffContact")}</p>
      )}
    </AuthShell>
  );
}
