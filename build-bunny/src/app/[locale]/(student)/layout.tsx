import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";

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
    <div
      data-theme="play"
      className="flex min-h-dvh flex-col bg-surface text-ink"
    >
      {ctx.impersonatedBy ? <ImpersonationBanner /> : null}
      {children}
    </div>
  );
}
