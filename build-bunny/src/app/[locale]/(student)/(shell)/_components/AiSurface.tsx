import type { ReactNode } from "react";

import { cn } from "@/ui";

/**
 * The AI-first look (the brief's visual direction) for a whole page:
 * Explore AI and My Learning. Tokens come from [data-theme="ai"] in
 * globals.css; the surrounding content area turns white with it.
 */
export function AiSurface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-theme="ai" className={cn("bb-ai-surface", className)}>
      {children}
    </div>
  );
}
