"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button, runAction } from "@/ui";

import { stopImpersonatingAction } from "./impersonation-actions";
import { localePath } from "./locale-path";

/**
 * Shown while a platform admin impersonates the current account. The shells
 * render it conditionally (ctx.impersonatedBy) — it carries the stop action
 * itself so every surface gets it for free.
 */
export function ImpersonationBanner() {
  const t = useTranslations("common");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);

  async function handleStop() {
    setLoading(true);
    try {
      const result = await runAction(() => stopImpersonatingAction());
      if (result.ok) {
        // Hard navigation: the new Set-Cookie only takes effect on the next request.
        window.location.assign(localePath(locale, result.data.redirectTo));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div role="status" className="border-b border-warning/30 bg-warning/10 print:hidden">
      <div className="bb-container flex flex-wrap items-center justify-between gap-2 py-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-warning">
          <span aria-hidden>👁️</span>
          {t("impersonation")}
        </p>
        <Button variant="ghost" size="sm" loading={loading} onClick={handleStop}>
          {t("impersonationStop")}
        </Button>
      </div>
    </div>
  );
}
