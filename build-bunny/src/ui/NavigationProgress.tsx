"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * A thin bar at the top of the screen while an in-app link is loading.
 *
 * It replaces the layout-level loading.tsx skeletons. Those put a Suspense
 * boundary around every page, and in production builds some client updates
 * inside it never committed: a click or a router.refresh() fetched the new
 * page and the screen stayed as it was. Without the boundary the old page
 * simply stays until the new one is ready, and this bar shows the click
 * was taken.
 *
 * Starts on a same-origin link click to another page; ends when the
 * pathname changes, or after 10 s if the navigation never happens.
 * Decorative (aria-hidden): the new page's own heading is the signal for a
 * screen reader. Under reduced motion it is a still bar.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  useEffect(() => {
    // Capture phase: Next's <Link> cancels the click's default to navigate
    // on the client, so by the bubble phase every in-app link looks cancelled.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page (a hash or a filter in the query): nothing to wait for.
      if (url.pathname === window.location.pathname) return;
      setPending(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setPending(false), 10_000);
    return () => window.clearTimeout(timer);
  }, [pending]);

  return <div aria-hidden="true" data-pending={pending ? "" : undefined} className="bb-nav-progress" />;
}
