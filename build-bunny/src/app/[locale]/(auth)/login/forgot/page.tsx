import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { AuthShell } from "../../_components/AuthShell";

interface Props {
  params: Promise<{ locale: string }>;
}

// Honest static page: staff password resets are handled by the school admin
// (and school-admin resets by NITAQ) in V1 — there is no email reset flow yet,
// so we don't pretend there is one.
export default async function ForgotPasswordPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.forgot");

  return (
    <AuthShell theme="pro" title={t("title")}>
      <p className="text-sm leading-relaxed text-ink-muted">{t("body")}</p>
      <div className="border-t border-border-token pt-4 text-sm">
        <Link href="/login" className="font-semibold text-brand hover:underline">
          {t("backLink")}
        </Link>
      </div>
    </AuthShell>
  );
}
