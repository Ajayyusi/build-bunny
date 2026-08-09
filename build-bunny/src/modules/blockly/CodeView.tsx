import { cn } from "@/ui/cn";

/**
 * Read-only display of the generated program (BLOCKS ⇄ CODE toggle). Plain
 * markup on theme tokens — code is short, so a syntax highlighter would be
 * dead weight. Always LTR: code is code, whatever the app locale.
 */

export interface CodeViewProps {
  code: string;
  className?: string;
}

export function CodeView({ code, className }: CodeViewProps) {
  const lines = code.replace(/\n$/, "").split("\n");

  return (
    <div
      dir="ltr"
      className={cn(
        "overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]",
        "bg-[var(--bb-ink-900)] px-4 py-3 font-mono text-sm leading-6",
        className,
      )}
    >
      <ol className="min-w-max list-none">
        {lines.map((line, index) => (
          <li key={index} className="flex gap-4">
            <span
              aria-hidden
              className="w-6 shrink-0 select-none text-right tabular-nums text-[var(--bb-ink-400)]"
            >
              {index + 1}
            </span>
            <span className="whitespace-pre text-[var(--bb-cream-100)]">
              {line}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
