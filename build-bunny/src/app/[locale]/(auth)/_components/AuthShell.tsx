import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Card, CardBody, SkipLink } from "@/ui";
import { NitaqLogo } from "@/ui/BrandLogo";
import { schoolFontVariable } from "@/ui/fonts";

import { LocaleSwitcher } from "../../_components/LocaleSwitcher";

interface AuthShellProps {
  theme: "play" | "pro";
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
}

/**
 * Full-viewport centered card used by every (auth) page (staff login,
 * student login, join, change password). The NITAQ mark sits above the
 * card — brand decision: this is the surface a school administrator judges
 * first, so the institutional identity leads even on the student-facing
 * login. Poppins headings (schoolFontVariable) for the same reason; auth is
 * a "school-facing" surface regardless of which role is signing in.
 */
export async function AuthShell({
  theme,
  title,
  subtitle,
  children,
}: AuthShellProps) {
  const [t, locale] = await Promise.all([
    getTranslations("common"),
    getLocale() as Promise<Locale>,
  ]);

  return (
    <div
      data-theme={theme}
      className={`flex min-h-dvh flex-col bg-surface text-ink ${schoolFontVariable(locale)}`}
    >
      <SkipLink label={t("skipToContent")} />
      <header className="bb-container flex h-16 items-center justify-between">
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded-md font-display text-lg font-bold text-ink"
        >
          <span aria-hidden>🐰</span>
          {t("appName")}
        </Link>
        {/* Reachable BEFORE signing in: the sign-in pages are exactly where
            someone stranded in the wrong language cannot read their way to
            any other control. */}
        <LocaleSwitcher />
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 flex-col items-center justify-start gap-6 px-4 py-8 focus:outline-none sm:justify-center sm:pb-24"
      >
        <NitaqLogo size="sm" />
        <Card className="w-full max-w-md">
          <CardBody className="flex flex-col gap-6 p-6 sm:p-8">
            <div className="flex flex-col gap-1">
              <h1 className="font-display text-2xl font-bold">{title}</h1>
              {subtitle ? (
                <p className="text-sm text-ink-muted">{subtitle}</p>
              ) : null}
            </div>
            {children}
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
