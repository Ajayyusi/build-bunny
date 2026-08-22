"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { usePathname } from "@/i18n/navigation";
import { BunnyMascot, cn } from "@/ui";

interface SidebarShellProps {
  sidebar: ReactNode;
  children: ReactNode;
  /** Localized label for the open/close control. */
  menuLabel: string;
  /**
   * Unread count to surface ON the hamburger below `lg`.
   *
   * The nav badge itself lives inside the drawer, which below `lg` is closed
   * and off-canvas — so on the shared classroom tablets this product targets,
   * a child had no way to know a message was waiting until they happened to
   * open the menu. A badge nobody can see notifies nobody.
   */
  badge?: number;
  /** Localized description of the badge, e.g. "2 unread messages". */
  badgeLabel?: string;
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
  badge = 0,
  badgeLabel,
}: SidebarShellProps) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [rtl, setRtl] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setRtl(document.documentElement.dir === "rtl");
  }, []);

  // Navigating inside the drawer should dismiss it — but ONLY on a real
  // route change. Running setOpen(false) on every pathname effect pass
  // (including the mount pass, and any re-run triggered by a new pathname
  // identity) closes the drawer in the same tick it was opened, so the
  // hamburger appears dead. Comparing against the previous value keeps the
  // dismissal without fighting the toggle.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Drawer offset as an inline `transform`.
  //
  // Three approaches were tried here; the first two are worth not
  // repeating. Tailwind v4's translate utilities set the standalone
  // `translate` property, so `transition-transform` never animated them,
  // and toggling `-translate-x-full` ⇄ `translate-x-0` left the closed
  // value winning after the class swapped. Inline `inset-inline-start`
  // then lost to an `!important` logical-inset declaration. `transform`
  // has no such competitor, and inline beats every non-important rule.
  //
  // RTL flips the travel direction, read from the document after mount.
  // Both signs are off-screen, so the pre-hydration default is safe
  // either way — only the direction of the slide differs.
  const offscreen = rtl ? "translateX(100%)" : "translateX(-100%)";
  const drawerStyle: React.CSSProperties = {
    transform: open ? "translateX(0)" : offscreen,
    transition: "transform 300ms cubic-bezier(0.16, 1, 0.3, 1)",
  };

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
        style={drawerStyle}
        className={cn(
          "z-50 flex w-64 shrink-0 flex-col gap-6 overflow-y-auto border-e border-border-token bg-surface-raised px-4 py-5",
          // Below lg this is a fixed off-canvas drawer moved by the inline
          // transform above; at lg it becomes a normal static column and
          // the transform is cleared by lg:!transform-none.
          "fixed inset-y-0 start-0 lg:static lg:!transform-none",
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
            // The count goes in the BUTTON's name, not a separate element:
            // a screen-reader user hears "Open menu, 2 unread messages"
            // instead of reaching a lone number with no context.
            aria-label={badge > 0 && badgeLabel ? `${menuLabel} — ${badgeLabel}` : menuLabel}
            aria-expanded={open}
            className="relative grid size-11 place-items-center rounded-lg border border-border-token text-ink transition-colors hover:bg-surface-sunken"
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
            {badge > 0 ? (
              // Purely visual — the meaning is already in aria-label above,
              // so announcing it twice would be noise. Positioned with the
              // logical `end` so it flips with the drawer in Arabic.
              <span
                aria-hidden="true"
                className="absolute -end-1 -top-1 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-xs font-bold tabular-nums text-on-brand"
              >
                {badge}
              </span>
            ) : null}
          </button>
          <span className="flex items-center font-display text-base font-bold text-ink">
            <BunnyMascot size="xs" className="me-1.5" />
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
