import type { Metadata } from "next";
import type { ReactNode } from "react";

// Fallback metadata only — the [locale] layout overrides the description with
// a translated one per locale.
export const metadata: Metadata = {
  title: "Build Bunny",
  description:
    "A playful coding platform for Grades 3–7, built for schools by NITAQ Academy.",
};

// Passthrough: <html>/<body> live in [locale]/layout.tsx so lang/dir and the
// locale font pair can follow the negotiated locale.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
