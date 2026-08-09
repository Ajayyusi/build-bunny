import { routing } from "@/i18n/routing";

/**
 * Hard navigations (window.location.assign) bypass next-intl's Link/router,
 * so the locale prefix must be re-applied by hand (localePrefix "as-needed":
 * default locale is unprefixed, everything else is /{locale}/...).
 */
export function localePath(locale: string, path: string): string {
  return locale === routing.defaultLocale ? path : `/${locale}${path}`;
}
