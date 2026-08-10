"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus trap for custom modal-style overlays that can't use the native
 * `<dialog>` element (m5 §41 accessibility audit finding). Dialog.tsx
 * already gets this for free from `showModal()` — IntroOverlay,
 * SuccessOverlay and CertificatesPanel's print preview are absolutely/fixed
 * positioned INSIDE their own page instead of promoted to the top layer, so
 * `<dialog>` isn't a drop-in fit there. This hook gives them the same three
 * WCAG 2.4.3 guarantees by hand: focus moves in on open, Tab/Shift+Tab can't
 * leave while it's open, and focus returns to whatever opened it on close.
 *
 * `resetKey` re-runs the trap (re-focuses the first control, rebinds
 * listeners to the new DOM) when the overlay's content is replaced in place
 * rather than unmounted — e.g. SuccessOverlay swapping its star-burst stage
 * for the explanation-card stage inside the same `role="dialog"` lifetime.
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  resetKey?: unknown,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null,
      );

    // The container itself is the fallback focus target (it carries
    // tabIndex={-1} at every call site) for a dialog with no focusable
    // controls yet (e.g. a loading state).
    (focusables()[0] ?? container).focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      // Only meaningful once the overlay is truly gone (unmount or
      // active:false) — a resetKey-driven re-run restores-then-instantly-
      // refocuses within the same commit, so there is no visible flicker.
      previouslyFocused?.focus();
    };
    // resetKey is an intentional extra trigger (not read inside the effect
    // body) — including it in the array is exactly what re-runs the trap.
  }, [active, resetKey]);

  return ref;
}
