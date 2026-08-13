import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { ToastProvider } from "@/ui";
import { fontVariables } from "@/ui/fonts";

import "../globals.css";

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "common" });
  // Brand names stay literal (not translated) in both locales — a NITAQ
  // Academy naming decision, see brand brief §Naming. Icons/metadataBase/
  // theme-color are inherited from the root layout's static metadata.
  return {
    title: `${t("appName")} — NITAQ Academy`,
    description: t("metaDescription"),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("common");

  return (
    // fontVariables' class belongs on <html>, not <body>: globals.css's
    // Layer 2 declares --font-body/--font-display via `:root { var(--bb-
    // font-body, ...fallback) }`, and :root matches <html> only — a custom
    // property set on <body> (html's own child) isn't visible to a rule
    // evaluated at html, since inheritance flows downward, not up. Setting
    // it here means :root's own resolution sees the real value instead of
    // silently falling through to the hardcoded fallback chain (invisible
    // in English, where "Inter" is first in both; wrong in Arabic, where
    // it put a Latin face ahead of IBM Plex Sans Arabic for any text not
    // inside a [data-theme] subtree).
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={fontVariables(locale)}>
      <body>
        <NextIntlClientProvider>
          <ToastProvider dismissLabel={t("dismiss")}>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
