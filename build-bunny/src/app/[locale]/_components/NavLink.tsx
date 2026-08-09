"use client";

import type { ReactNode } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/ui";

interface NavLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  /** Only highlight on an exact path match — for a section root whose href
   * would otherwise prefix-match every one of its own sibling sub-pages. */
  exact?: boolean;
}

/** Shell nav item with aria-current styling; 44px tall for student surfaces. */
export function NavLink({ href, children, className, exact = false }: NavLinkProps) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-11 items-center rounded-md px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink",
        "aria-[current=page]:bg-brand/10 aria-[current=page]:text-brand",
        className,
      )}
    >
      {children}
    </Link>
  );
}
