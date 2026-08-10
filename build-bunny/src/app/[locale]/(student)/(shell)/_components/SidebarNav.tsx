"use client";

import type { ReactNode } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/ui";

interface SidebarNavItemProps {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}

/**
 * One sidebar row. Active state is a solid brand pill (matching the
 * reference's filled nav item) rather than a tint, because at sidebar
 * width the tint alone was too quiet to find at a glance.
 *
 * 44px tall — the same touch target the old top-nav used, kept because
 * the primary audience is 8-12 year olds on shared classroom hardware.
 */
export function SidebarNavItem({ href, icon, children }: SidebarNavItemProps) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold transition-colors",
        active
          ? "bg-brand text-on-brand shadow-soft"
          : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
      )}
    >
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center transition-transform",
          !active && "group-hover:scale-110",
        )}
      >
        {icon}
      </span>
      <span className="truncate">{children}</span>
    </Link>
  );
}
