"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import type { AiSimWidget } from "@/modules/curriculum/schemas";

/**
 * AI_SIM widget registry (phase G, agent A client half): keyed by widgetId,
 * exposing the lazy player component for each of the three widgets. Mirrors
 * `src/modules/activities/players/registry.tsx`'s pattern one level down —
 * that file dispatches on ActivityType (AI_SIM is one entry there, via
 * AiSimPlayer), this one dispatches on widgetId within AI_SIM. Every entry
 * is lazy so a boundary-builder level never pulls in the canvas-heavy
 * pixel-playground bundle and vice versa.
 *
 * Server-side counterpart: src/modules/ai/lab/registry.ts (grade + strip
 * per widget) — deliberately a SEPARATE file, since that one is imported
 * from server code and this one requires "use client".
 */

export interface AiSimWidgetPlayerProps {
  /** The (already student-stripped) widget config — cast internally per widget, same convention as ActivityPlayerProps.payload. */
  config: unknown;
  locale: string;
  /** True once the attempt has been submitted — every widget must stop accepting input. */
  disabled: boolean;
  reducedMotion: boolean;
  /** Called whenever the child's work changes; `ready` gates the wrapper's Submit button. */
  onWorkChange: (work: unknown, ready: boolean) => void;
  /**
   * A previously autosaved snapshot in the SAME shape this widget reports
   * through onWorkChange, or null. Untrusted: it comes from a past session
   * and must be validated before use — a malformed draft has to degrade to
   * the widget's normal starting state, never break the level.
   */
  initialWork?: unknown;
}

const BoundaryBuilder = dynamic(
  () => import("./BoundaryBuilder").then((m) => m.BoundaryBuilder),
  { ssr: false },
);
const TrendLine = dynamic(() => import("./TrendLine").then((m) => m.TrendLine), { ssr: false });
const PixelPlayground = dynamic(
  () => import("./PixelPlayground").then((m) => m.PixelPlayground),
  { ssr: false },
);

const AI_SIM_WIDGET_PLAYERS: Record<AiSimWidget, ComponentType<AiSimWidgetPlayerProps>> = {
  "boundary-builder": BoundaryBuilder,
  "trend-line": TrendLine,
  "pixel-playground": PixelPlayground,
};

export function getAiSimWidgetPlayer(
  widgetId: string,
): ComponentType<AiSimWidgetPlayerProps> | undefined {
  return AI_SIM_WIDGET_PLAYERS[widgetId as AiSimWidget];
}
