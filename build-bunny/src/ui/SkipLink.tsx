export interface SkipLinkProps {
  /** Localized "Skip to content" label. */
  label: string;
  /** Must match the target element's id (default "main-content"). */
  targetId?: string;
}

/**
 * WCAG 2.4.1 (Bypass Blocks): the first focusable element on every shell, so
 * a keyboard user doesn't have to tab through the header/nav on every single
 * page load to reach the actual content. Invisible until it receives focus
 * (Tab from a fresh page load lands here first); `sr-only`/`not-sr-only` are
 * Tailwind's standard visually-hidden idiom. Pair with `id={targetId}
 * tabIndex={-1}` on the destination `<main>` so the jump actually MOVES
 * focus, not just scroll position (a bare in-page anchor to a
 * non-focusable element does not).
 */
export function SkipLink({ label, targetId = "main-content" }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-brand focus:shadow-raised focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus"
    >
      {label}
    </a>
  );
}
