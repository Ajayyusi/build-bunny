import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { env } from "@/lib/env";

// Locale-invariant metadata (icons, canonical base, theme colour) lives here
// so it survives even if the [locale] layout's notFound() ever fires before
// its own generateMetadata runs; title/description below are fallbacks only
// — the [locale] layout overrides both with translated, locale-correct
// values on every real request.
export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: "Build Bunny — NITAQ Academy",
  description:
    "A playful coding platform for Grades 3–7, built for schools by NITAQ Academy.",
  icons: {
    // brand-assets.mjs (public/brand/) generates these from the official
    // NITAQ mark; sizes match the file names exactly.
    icon: [
      { url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Build Bunny — NITAQ Academy",
    description:
      "A playful coding platform for Grades 3–7, built for schools by NITAQ Academy.",
    images: ["/brand/nitaq-logo.png"],
  },
};

// theme-color is a separate export from `metadata` since Next 15 (viewport
// concerns, not document-head concerns) — NITAQ's --primary-color, matching
// the icons above and the realigned --bb-meadow-600 token.
export const viewport: Viewport = {
  themeColor: "#2e7d32",
};

// Passthrough: <html>/<body> live in [locale]/layout.tsx so lang/dir and the
// locale font pair can follow the negotiated locale.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
