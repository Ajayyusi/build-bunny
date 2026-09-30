import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { DisplayProvider, SoundProvider } from "@/ui";

import { ImpersonationBanner } from "../_components/ImpersonationBanner";

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Student surface root: role gate + Play theme only (m3 route contract).
 * Chrome (header/nav) lives in the (shell) sub-group; the (immersive)
 * player renders full-bleed inside this wrapper. The impersonation banner
 * stays here so a staff preview is labelled on EVERY student screen,
 * chrome or not.
 */
export default async function StudentLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireRole("STUDENT");

  return (
    // Visual direction everywhere (flag 2, option B): the brief's AI-first
    // look on every student screen, Coding Lab and level play included.
    // Toy Box stays underneath (data-theme="play"), so its component rules
    // (button ledges, the go button) still apply; the "ai" tokens nested
    // inside win for colour, and the sky background gives way to white.
    <div data-theme="play" className="flex min-h-dvh flex-col bg-white text-ink">
      <div data-theme="ai" className="contents">
        {ctx.impersonatedBy ? <ImpersonationBanner /> : null}
        <DisplayProvider>
          <SoundProvider locale={locale}>{children}</SoundProvider>
        </DisplayProvider>
      </div>
    </div>
  );
}
