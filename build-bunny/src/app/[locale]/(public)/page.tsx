import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { homePathForRole } from "@/modules/auth/roles";
import { getSessionContext } from "@/modules/auth/server/session";
import { BrandLockup, NitaqLogo } from "@/ui/BrandLogo";
import { BunnyMascot } from "@/ui/BunnyMascot";
import { schoolFontVariable } from "@/ui/fonts";

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Signed-in visitors go straight to their shell (routes doc §2.1).
  const ctx = await getSessionContext();
  if (ctx && !ctx.mustChangePassword) {
    redirect({ href: homePathForRole(ctx.role), locale });
  }
  const [t, tCommon] = await Promise.all([
    getTranslations("landing"),
    getTranslations("common"),
  ]);
  const other: Locale = locale === "ar" ? "en" : "ar";

  return (
    <div
      data-theme="play"
      className={`flex min-h-dvh flex-col bg-surface text-ink ${schoolFontVariable(locale as Locale)}`}
    >
      <header className="bb-container flex h-16 items-center justify-between">
        <BrandLockup byLabel={tCommon("byNitaq")} />
        <Link
          href="/"
          locale={other}
          className="inline-flex h-11 items-center rounded-md px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <span lang={other}>
            {other === "ar" ? tCommon("arabic") : tCommon("english")}
          </span>
        </Link>
      </header>

      <main className="bb-container flex flex-1 flex-col items-center justify-center gap-8 py-16 text-center">
        <div aria-hidden className="grid size-28 place-items-center rounded-full bg-brand/10">
          <BunnyMascot state="waving" size="sm" className="translate-y-1" />
        </div>
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-4xl font-bold sm:text-5xl">
            {tCommon("appName")}
          </h1>
          <p className="mx-auto max-w-md text-lg text-ink-muted">
            {t("tagline")}
          </p>
        </div>
        <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/student-login"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-lg bg-brand px-6 text-base font-semibold text-on-brand transition-colors hover:bg-brand-strong sm:flex-none sm:min-w-48"
          >
            {t("studentCta")}
          </Link>
          <Link
            href="/login"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-lg border border-border-token bg-surface-raised px-6 text-base font-semibold text-ink transition-colors hover:bg-surface-sunken sm:flex-none sm:min-w-48"
          >
            {t("staffCta")}
          </Link>
        </div>
      </main>

      <footer className="bb-container flex flex-wrap items-center justify-center gap-3 py-5 text-sm text-ink-muted">
        <NitaqLogo size="sm" className="max-h-6" />
        <span>{t("footer")}</span>
      </footer>
    </div>
  );
}
