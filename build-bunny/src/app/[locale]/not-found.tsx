import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { BunnyMascot } from "@/ui";

// Theme-neutral on purpose (the :root Play defaults apply) — a 404 can be hit
// from any surface.
export default async function NotFoundPage() {
  const t = await getTranslations("errors");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-6 text-center text-ink">
      <BunnyMascot state="confused" size="lg" />
      <h1 className="font-display text-3xl font-bold">{t("notFoundTitle")}</h1>
      <p className="max-w-sm text-ink-muted">{t("notFoundBody")}</p>
      <Link
        href="/"
        className="mt-2 inline-flex h-11 items-center justify-center rounded-lg border border-border-token bg-surface-raised px-5 text-sm font-semibold text-ink transition-colors hover:bg-surface-sunken"
      >
        {t("goHome")}
      </Link>
    </div>
  );
}
