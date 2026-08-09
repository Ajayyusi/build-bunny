import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Projector-mode root (m4 deliverable 7): role gate + Pro theme only, NO
 * chrome (no header/nav/avatar) — smartboard-friendly, matching the same
 * "(immersive) sibling group with its own layout" pattern the student
 * player uses to escape its shell.
 */
export default async function StaffLiveLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("TEACHER", "SCHOOL_ADMIN");

  return (
    <div data-theme="pro" className="min-h-dvh bg-surface text-ink">
      {children}
    </div>
  );
}
