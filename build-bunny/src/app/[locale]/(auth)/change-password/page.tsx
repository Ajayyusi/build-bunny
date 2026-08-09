import { getTranslations, setRequestLocale } from "next-intl/server";

import { redirect } from "@/i18n/navigation";
import { homePathForRole } from "@/modules/auth/roles";
import { getSessionContext } from "@/modules/auth/server/session";

import { AuthShell } from "../_components/AuthShell";
import { ChangePasswordForm } from "./ChangePasswordForm";

interface Props {
  params: Promise<{ locale: string }>;
}

// Requires a session but deliberately NOT requireRole: that guard bounces
// mustChangePassword users right back here, which would loop.
export default async function ChangePasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await getSessionContext();
  if (!ctx) {
    redirect({ href: "/login", locale });
    // redirect() always throws — this only narrows the type for TS.
    return null;
  }

  const t = await getTranslations("auth.changePassword");
  const isStudent = ctx.role === "STUDENT";

  return (
    <AuthShell
      theme={isStudent ? "play" : "pro"}
      title={t("title")}
      subtitle={ctx.mustChangePassword ? t("requiredNote") : undefined}
    >
      <ChangePasswordForm
        homePath={homePathForRole(ctx.role)}
        inputSize={isStudent ? "lg" : "md"}
      />
    </AuthShell>
  );
}
