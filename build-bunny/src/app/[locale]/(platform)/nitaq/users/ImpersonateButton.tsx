"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button, runAction, useToast } from "@/ui";

import { impersonateUserAction } from "./actions";
import { localePath } from "../../../_components/locale-path";

export function ImpersonateButton({ userId }: { userId: string }) {
  const t = useTranslations("platform.users");
  const locale = useLocale();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const result = await runAction(() => impersonateUserAction({ userId }));
      if (!result.ok) {
        toast({
          title: result.error === "FORBIDDEN" ? t("forbidden") : t("errorGeneric"),
          variant: "danger",
        });
        return;
      }
      // Hard navigation: the new Set-Cookie only takes effect on the next request.
      window.location.assign(localePath(locale, result.data.redirectTo));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" loading={loading} onClick={handleClick}>
      {t("impersonateCta")}
    </Button>
  );
}
