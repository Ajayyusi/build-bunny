"use client";

import { useLocale, useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/ui";

interface LocaleSwitcherProps {
  /** "lg" (44px) on student surfaces. */
  size?: "md" | "lg";
  className?: string;
}

/** Switching locale = navigating to the same path in the other locale. */
export function LocaleSwitcher({ size = "md", className }: LocaleSwitcherProps) {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const other: Locale = locale === "ar" ? "en" : "ar";

  return (
    <button
      type="button"
      aria-label={t("language")}
      onClick={() => router.replace(pathname, { locale: other })}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-3 font-semibold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink",
        size === "lg" ? "h-11 text-base" : "h-9 text-sm",
        className,
      )}
    >
      <span lang={other}>{other === "ar" ? t("arabic") : t("english")}</span>
    </button>
  );
}
