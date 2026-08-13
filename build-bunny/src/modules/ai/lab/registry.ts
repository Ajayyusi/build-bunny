import "server-only";

import {
  AI_SIM_WIDGETS,
  boundaryBuilderConfig,
  pixelPlaygroundConfig,
  trendLineConfig,
  type AiSimWidget,
} from "@/modules/curriculum/schemas";
import type { ActivityGradeResult } from "@/modules/activities/types";

import { gradeBoundaryBuilder, stripBoundaryBuilderConfig } from "./boundary-builder/grade";
import { gradePixelPlayground, stripPixelPlaygroundConfig } from "./pixel-playground/grade";
import { gradeTrendLine, stripTrendLineConfig } from "./trend-line/grade";

/**
 * The AI_SIM widget registry (phase G, agent A): keyed by widgetId, exposing
 * a pure server-safe grader + config stripper per widget. This is what
 * `src/modules/activities/server/registry.ts`'s AI_SIM entry delegates to —
 * that file dispatches on ActivityType (AI_SIM), this one dispatches on
 * widgetId within it. Deliberately NOT the same file: AI_SIM is one
 * ActivityType with three very different widgets behind it, and this
 * registry is the seam that keeps their maths and grading self-contained
 * (each widget's grade() imports only from src/modules/ai/lab/math/, never
 * duplicating arithmetic the client widget also runs).
 *
 * Both `grade` and `stripConfig` re-parse `config` against the widget's own
 * curriculum schema before touching it — belt-and-suspenders the same way
 * codePrediction/sequencing re-parse their payload, and it means the
 * per-widget grade() functions get a genuinely typed config instead of an
 * unsafe cast at this boundary.
 */

export interface AiSimWidgetEngine {
  grade(config: unknown, submission: unknown): ActivityGradeResult;
  stripConfig(config: unknown): unknown;
}

function invalidConfigResult(): ActivityGradeResult {
  return {
    verdict: "ERROR",
    qualityPassed: false,
    primaryFeedback: { code: "runtimeError", data: { reason: "invalidConfig" } },
    generatedCode: "",
    blockCount: null,
    summary: {},
  };
}

const boundaryBuilder: AiSimWidgetEngine = {
  grade: (config, submission) => {
    const parsed = boundaryBuilderConfig.safeParse(config);
    return parsed.success ? gradeBoundaryBuilder(parsed.data, submission) : invalidConfigResult();
  },
  stripConfig: (config) => {
    const parsed = boundaryBuilderConfig.safeParse(config);
    return parsed.success ? stripBoundaryBuilderConfig(parsed.data) : config;
  },
};

const trendLine: AiSimWidgetEngine = {
  grade: (config, submission) => {
    const parsed = trendLineConfig.safeParse(config);
    return parsed.success ? gradeTrendLine(parsed.data, submission) : invalidConfigResult();
  },
  stripConfig: (config) => {
    const parsed = trendLineConfig.safeParse(config);
    return parsed.success ? stripTrendLineConfig(parsed.data) : config;
  },
};

const pixelPlayground: AiSimWidgetEngine = {
  grade: (config, submission) => {
    const parsed = pixelPlaygroundConfig.safeParse(config);
    return parsed.success ? gradePixelPlayground(parsed.data, submission) : invalidConfigResult();
  },
  stripConfig: (config) => {
    const parsed = pixelPlaygroundConfig.safeParse(config);
    return parsed.success ? stripPixelPlaygroundConfig(parsed.data) : config;
  },
};

export const AI_SIM_WIDGET_ENGINES: Record<AiSimWidget, AiSimWidgetEngine> = {
  "boundary-builder": boundaryBuilder,
  "trend-line": trendLine,
  "pixel-playground": pixelPlayground,
};

export function getAiSimWidgetEngine(widgetId: string): AiSimWidgetEngine | undefined {
  if (!(AI_SIM_WIDGETS as readonly string[]).includes(widgetId)) return undefined;
  return AI_SIM_WIDGET_ENGINES[widgetId as AiSimWidget];
}
