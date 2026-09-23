"use client";

import { Button } from "@/ui";

/** Prints the current page — the staff chrome hides itself in print. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="secondary" onClick={() => window.print()} className="print:hidden">
      <span aria-hidden="true">🖨️</span>
      {label}
    </Button>
  );
}
