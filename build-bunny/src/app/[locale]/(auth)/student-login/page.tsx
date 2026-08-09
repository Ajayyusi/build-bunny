import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link, redirect } from "@/i18n/navigation";
import { homePathForRole } from "@/modules/auth/roles";
import { getSessionContext } from "@/modules/auth/server/session";

import { AuthShell } from "../_components/AuthShell";
import { StudentLoginForm } from "./StudentLoginForm";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function StudentLoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Already signed in → straight to their shell (change-password flow excepted).
  const ctx = await getSessionContext();
  if (ctx && !ctx.mustChangePassword) {
    redirect({ href: homePathForRole(ctx.role), locale });
  }

  const t = await getTranslations("auth.student");

  return (
    <AuthShell theme="play" title={t("title")}>
      <StudentLoginForm />
      <div className="border-t border-border-token pt-4 text-sm">
        <Link href="/login" className="font-semibold text-brand hover:underline">
          {t("teacherLink")}
        </Link>
      </div>
    </AuthShell>
  );
}
