import {
  Baloo_2,
  Baloo_Bhaijaan_2,
  IBM_Plex_Sans_Arabic,
  Inter,
  Poppins,
} from "next/font/google";

import type { Locale } from "@/i18n/routing";

// Both locale pairs bind the same CSS variables (--bb-font-display /
// --bb-font-body) that the Layer-2 slots in globals.css consume, so exactly
// one pair must be applied per document — fontVariables() guarantees that.
// Latin subsets ride along with the Arabic fonts because Arabic pages still
// contain Latin usernames, class codes and numbers.
//
// Two English display faces exist (brand pass): Baloo 2 for the student
// product (a children's coding game needs warmth Poppins doesn't carry) and
// Poppins — matching nitaqacademy.com — for school-facing surfaces (public
// landing, auth, staff, platform, certificate). Body copy is Inter
// everywhere in English now, so only --bb-font-display needs a per-surface
// override; schoolFontVariable() below supplies just that, applied on top
// of the base fontVariables() pair on the surface's own wrapper element.
// Arabic keeps its single existing pairing regardless of surface — Poppins/
// Inter have no Arabic subset, and next/font is self-hosted only (no
// third-party webfont origin the CSP could add for a second Arabic pair).

const balooLatin = Baloo_2({
  subsets: ["latin"],
  display: "swap",
  variable: "--bb-font-display",
});

const poppinsLatin = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--bb-font-display",
});

const interLatin = Inter({
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
 * Class names that bind the locale's default display/body font pair to the
 * --bb-font-* variables. Apply once at the document root (next to the
 * lang/dir attributes) — this is the student-product pair in English
 * (Baloo 2 / Inter) and the sole pair in Arabic. School-facing surfaces
 * additionally apply schoolFontVariable() on their own theme wrapper.
 */
export function fontVariables(locale: Locale): string {
  return locale === "ar"
    ? `${balooArabic.variable} ${plexArabic.variable}`
    : `${balooLatin.variable} ${interLatin.variable}`;
}

/**
 * Overrides just --bb-font-display with Poppins for school-facing surfaces
 * (landing, auth, staff /teach + /school, platform /nitaq, certificate).
 * Apply as an extra className on that surface's own [data-theme] wrapper —
 * CSS custom properties re-declared there shadow the document-root value
 * for everything inside, without touching --bb-font-body (Inter already
 * covers both products in English) or Arabic (no override, same pairing).
 */
export function schoolFontVariable(locale: Locale): string {
  return locale === "ar" ? "" : poppinsLatin.variable;
}
