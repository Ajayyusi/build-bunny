import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { homePathForRole } from "@/modules/auth/roles";
import { getSessionContext } from "@/modules/auth/server/session";

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
    <div data-theme="play" className="flex min-h-dvh flex-col bg-surface text-ink">
      <header className="bb-container flex h-16 items-center justify-between">
        <span className="flex items-center gap-2 font-display text-lg font-bold">
          <span aria-hidden>🐰</span>
          {tCommon("appName")}
        </span>
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
        <div
          aria-hidden
          className="grid size-24 place-items-center rounded-full bg-brand/10 text-6xl"
        >
          🐰
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

      <footer className="bb-container flex h-14 items-center justify-center text-sm text-ink-muted">
        {t("footer")}
      </footer>
    </div>
  );
}
