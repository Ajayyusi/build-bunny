"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { usePathname } from "@/i18n/navigation";
import { cn } from "@/ui";

interface SidebarShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  /** Localized label for the open/close control. */
  menuLabel: string;
}

/**
 * Responsive frame for the sidebar layout.
 *
 * ≥ lg  : the sidebar is a permanent column; no JS involved.
 * < lg  : it becomes an off-canvas drawer behind a hamburger, because a
 *         240px rail on a 375px phone would leave nothing for content.
 *
 * The drawer closes on route change and on Escape. The nav markup is
 * rendered ONCE and moved by CSS rather than duplicated, so there is no
 * second copy of the links for screen readers to walk.
 */
export function SidebarShell({
  sidebar,
  children,
  menuLabel,
}: SidebarShellProps) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Navigating inside the drawer should dismiss it.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex min-h-dvh">
      {/* Scrim — only mounted while the drawer is open, below lg only. */}
      {open ? (
        <button
          type="button"
          aria-label={t("close")}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "z-50 flex w-64 shrink-0 flex-col gap-6 border-e border-border-token bg-surface-raised px-4 py-5",
          // Mobile: off-canvas drawer sliding from the inline-start edge.
          "fixed inset-y-0 start-0 transition-transform duration-300 ease-out lg:static lg:translate-x-0 lg:transition-none",
          open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
          "lg:rtl:translate-x-0",
        )}
      >
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile-only top bar carrying the drawer toggle. */}
        <div className="flex items-center gap-3 border-b border-border-token bg-surface-raised px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={menuLabel}
            aria-expanded={open}
            className="grid size-10 place-items-center rounded-lg border border-border-token text-ink transition-colors hover:bg-surface-sunken"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
              className="size-5"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <span className="font-display text-base font-bold text-ink">
            <span aria-hidden className="me-1.5">
              🐰
            </span>
            {t("appName")}
          </span>
        </div>

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
