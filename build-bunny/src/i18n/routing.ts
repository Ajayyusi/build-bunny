import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ar"],
  defaultLocale: "en",
  // Clean English URLs; Arabic under /ar/... (plan §4 C).
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
