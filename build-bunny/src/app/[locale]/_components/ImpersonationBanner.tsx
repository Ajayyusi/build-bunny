"use client";

import { useTranslations } from "next-intl";

/**
 * Shown while a platform admin impersonates the current account. The shells
 * render it conditionally (ctx.impersonatedBy) — it carries no logic itself.
 */
export function ImpersonationBanner() {
  const t = useTranslations("common");

  return (
    <div role="status" className="border-b border-warning/30 bg-warning/10">
      <p className="bb-container flex items-center gap-2 py-2 text-sm font-semibold text-warning">
        <span aria-hidden>👁️</span>
        {t("impersonation")}
      </p>
    </div>
  );
}
