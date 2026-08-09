import type { ReactNode } from "react";

// The theme differs per auth page (student sign-in is Play, staff is Pro) and
// must cover the full viewport background, so each page renders the shared
// AuthShell itself — this layout only establishes the route group.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return children;
}
