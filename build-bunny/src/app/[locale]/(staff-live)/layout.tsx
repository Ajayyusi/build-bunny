import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { requireRole } from "@/modules/auth/server/session";
import { SkipLink } from "@/ui";

interface Props {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * Projector-mode root (m4 deliverable 7): role gate + Pro theme only, NO
 * chrome (no header/nav/avatar) — smartboard-friendly, matching the same
 * "(immersive) sibling group with its own layout" pattern the student
 * player uses to escape its shell. Still gets a skip link + focusable
 * #main-content: LiveView renders its own on-page controls (variant/level
 * picks) before the live data, so bypassing them is still worthwhile.
 */
export default async function StaffLiveLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("TEACHER", "SCHOOL_ADMIN");
  const tCommon = await getTranslations("common");

  return (
    <div data-theme="pro" className="min-h-dvh bg-surface text-ink">
      <SkipLink label={tCommon("skipToContent")} />
      <div id="main-content" tabIndex={-1} className="focus:outline-none">
        {children}
      </div>
    </div>
  );
}
