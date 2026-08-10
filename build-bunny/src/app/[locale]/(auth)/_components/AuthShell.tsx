import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Card, CardBody, SkipLink } from "@/ui";

interface AuthShellProps {
  theme: "play" | "pro";
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
}

/** Full-viewport centered card used by every (auth) page. */
export async function AuthShell({
  theme,
  title,
  subtitle,
  children,
}: AuthShellProps) {
  const t = await getTranslations("common");

  return (
    <div data-theme={theme} className="flex min-h-dvh flex-col bg-surface text-ink">
      <SkipLink label={t("skipToContent")} />
      <header className="bb-container flex h-16 items-center">
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded-md font-display text-lg font-bold text-ink"
        >
          <span aria-hidden>🐰</span>
          {t("appName")}
        </Link>
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 items-start justify-center px-4 py-8 focus:outline-none sm:items-center sm:pb-24"
      >
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
