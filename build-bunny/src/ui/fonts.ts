import {
  Baloo_2,
  Baloo_Bhaijaan_2,
  IBM_Plex_Sans_Arabic,
  Nunito_Sans,
} from "next/font/google";

import type { Locale } from "@/i18n/routing";

// Both locale pairs bind the same CSS variables (--bb-font-display /
// --bb-font-body) that the Layer-2 slots in globals.css consume, so exactly
// one pair must be applied per document — fontVariables() guarantees that.
// Latin subsets ride along with the Arabic fonts because Arabic pages still
// contain Latin usernames, class codes and numbers.

const balooLatin = Baloo_2({
  subsets: ["latin"],
  display: "swap",
  variable: "--bb-font-display",
});

const nunitoLatin = Nunito_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--bb-font-body",
});

const balooArabic = Baloo_Bhaijaan_2({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--bb-font-display",
});

// IBM Plex Sans Arabic is not a variable font — weights must be explicit.
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--bb-font-body",
});

/**
 * Class names that bind the locale's display/body font pair to the
 * --bb-font-* variables. Apply to <html> (or <body>) next to the
 * data-theme attribute.
 */
export function fontVariables(locale: Locale): string {
  return locale === "ar"
    ? `${balooArabic.variable} ${plexArabic.variable}`
    : `${balooLatin.variable} ${nunitoLatin.variable}`;
}
