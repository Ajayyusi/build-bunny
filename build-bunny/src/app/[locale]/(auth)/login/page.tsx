import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link, redirect } from "@/i18n/navigation";
import { homePathForRole } from "@/modules/auth/roles";
import { getSessionContext } from "@/modules/auth/server/session";

import { AuthShell } from "../_components/AuthShell";
import { LoginForm } from "./LoginForm";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function StaffLoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Already signed in → straight to their shell (change-password flow excepted).
  const ctx = await getSessionContext();
  if (ctx && !ctx.mustChangePassword) {
    redirect({ href: homePathForRole(ctx.role), locale });
  }

  const t = await getTranslations("auth.staff");

  return (
    <AuthShell theme="pro" title={t("title")} subtitle={t("subtitle")}>
      <LoginForm />
      <div className="flex flex-col items-start gap-2 border-t border-border-token pt-4 text-sm">
        <Link
          href="/login/forgot"
          className="font-semibold text-brand hover:underline"
        >
          {t("forgotLink")}
        </Link>
        <Link
          href="/student-login"
          className="font-semibold text-brand hover:underline"
        >
          {t("studentLink")}
        </Link>
      </div>
    </AuthShell>
  );
}
