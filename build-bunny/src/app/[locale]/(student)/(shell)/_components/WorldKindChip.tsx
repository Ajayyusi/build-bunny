import { cn } from "@/ui";

/**
 * "AI" or "Coding" on a world: the redesign brief asks that a child can tell
 * which route teaches AI and which teaches programming. Violet (AI) is 5.9:1
 * on white and navy (coding) 11:1, so the chip reads on any world colour.
 */
export function WorldKindChip({ kind, label, className }: { kind: "ai" | "coding"; label: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex w-fit items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-xs font-bold", className)}
      style={{
        color: kind === "ai" ? "var(--bb-toy-violet)" : "var(--bb-toy-navy)",
        borderColor: kind === "ai" ? "color-mix(in oklab, var(--bb-toy-violet) 40%, white)" : "var(--bb-toy-line)",
      }}
    >
      <span aria-hidden="true">{kind === "ai" ? "✨" : "</>"}</span>
      {label}
    </span>
  );
}
