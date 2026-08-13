"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { cn } from "@/ui";

import { convolve3x3, EDGE_DETECTION_KERNEL } from "../math/convolve3x3";
import { downsampleRGB } from "../math/downsample";
import { greyscaleGrid } from "../math/greyscale";
import type { Grid, Kernel3x3, RGB } from "../math/types";
import type {
  PixelPlaygroundWork,
  StudentPixelPlaygroundConfig,
  StudentPixelRound,
} from "../pixel-playground/types";
import { resolveLocalized } from "./format";
import type { AiSimWidgetPlayerProps } from "./registry";
import { useStableCallback } from "./useStableCallback";
import styles from "./widgets.module.css";

/**
 * "See Like a Computer" (phase G, client half): a real pixel pipeline —
 * getImageData → downsampleRGB → greyscaleGrid → convolve3x3, the SAME pure
 * functions the math barrel exports — rendered onto <canvas> as chunky
 * filled cells, then a set of "mystery" identification rounds that report
 * the child's picks upward. Nothing here decides correctness: the server
 * re-checks each round's pick against imageId, which never reaches this
 * component (StudentPixelPlaygroundConfig strips it — see grade.ts).
 */

const BASE_SIZE = 128; // >= the schema's max resolution (128), so every slider notch is a genuine downsample.
const EXPLORE_DISPLAY = 320;
const ROUND_DISPLAY = 176;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Module-level: same-origin static assets under /ai-lab/, safe to cache for the tab's lifetime.
const pixelCache = new Map<string, Grid<RGB>>();

function loadBasePixels(src: string, baseSize: number): Promise<Grid<RGB>> {
  const key = `${src}@${baseSize}`;
  const cached = pixelCache.get(key);
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = baseSize;
      canvas.height = baseSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("no-2d-context"));
        return;
      }
      ctx.drawImage(img, 0, 0, baseSize, baseSize);
      const data = ctx.getImageData(0, 0, baseSize, baseSize).data;
      const grid: RGB[][] = [];
      for (let y = 0; y < baseSize; y++) {
        const row: RGB[] = [];
        for (let x = 0; x < baseSize; x++) {
          const i = (y * baseSize + x) * 4;
          row.push({ r: data[i]!, g: data[i + 1]!, b: data[i + 2]! });
        }
        grid.push(row);
      }
      pixelCache.set(key, grid);
      resolve(grid);
    };
    img.onerror = () => reject(new Error("image-load-failed"));
    img.src = src;
  });
}

type PixelStatus = "loading" | "ready" | "error";

function usePixelGrid(src: string | null): { grid: Grid<RGB> | null; status: PixelStatus } {
  const [state, setState] = useState<{ grid: Grid<RGB> | null; status: PixelStatus }>({
    grid: null,
    status: "loading",
  });
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    setState({ grid: null, status: "loading" });
    loadBasePixels(src, BASE_SIZE)
      .then((grid) => {
        if (!cancelled) setState({ grid, status: "ready" });
      })
      .catch(() => {
        if (!cancelled) setState({ grid: null, status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [src]);
  return state;
}

interface PixelCanvasProps {
  rgbGrid?: Grid<RGB> | null;
  greyGrid?: readonly (readonly number[])[] | null;
  greyOffset?: number;
  size: number;
  label: string;
  animate: boolean;
}

function PixelCanvas({ rgbGrid, greyGrid, greyOffset = 0, size, label, animate }: PixelCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    if (greyGrid) {
      const rows = greyGrid.length;
      const cols = greyGrid[0]?.length ?? 0;
      const cw = size / cols;
      const ch = size / rows;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const v = clamp(Math.round(greyGrid[y]![x]! + greyOffset), 0, 255);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(Math.floor(x * cw), Math.floor(y * ch), Math.ceil(cw) + 1, Math.ceil(ch) + 1);
        }
      }
    } else if (rgbGrid) {
      const rows = rgbGrid.length;
      const cols = rgbGrid[0]?.length ?? 0;
      const cw = size / cols;
      const ch = size / rows;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const { r, g, b } = rgbGrid[y]![x]!;
          ctx.fillStyle = `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
          ctx.fillRect(Math.floor(x * cw), Math.floor(y * ch), Math.ceil(cw) + 1, Math.ceil(ch) + 1);
        }
      }
    }
  }, [rgbGrid, greyGrid, greyOffset, size]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      className={cn("rounded-lg border border-border-token bg-surface-sunken", animate && styles.gridFadeIn)}
      style={{ width: size, height: size }}
    />
  );
}

function MysteryRoundCanvas({ round, size }: { round: StudentPixelRound; size: number }) {
  const t = useTranslations("student.play.aiSim.pixelPlayground");
  const { grid, status } = usePixelGrid(round.src);
  const resGrid = useMemo(
    () => (grid ? downsampleRGB(grid, round.resolution, round.resolution) : null),
    [grid, round.resolution],
  );
  if (status === "loading") {
    return (
      <div
        className="grid place-items-center rounded-lg border border-border-token bg-surface-sunken text-xs text-ink-muted"
        style={{ width: size, height: size }}
      >
        {t("loadingImage")}
      </div>
    );
  }
  if (status === "error" || !resGrid) {
    return (
      <div
        className="grid place-items-center rounded-lg border border-danger/35 bg-surface-sunken text-center text-xs text-danger"
        style={{ width: size, height: size }}
      >
        {t("loadError")}
      </div>
    );
  }
  return <PixelCanvas rgbGrid={resGrid} size={size} label={t("mysteryImageLabel", { resolution: round.resolution })} animate={false} />;
}

function toKernel3x3(matrix: number[][]): Kernel3x3 {
  return [
    [matrix[0]![0]!, matrix[0]![1]!, matrix[0]![2]!],
    [matrix[1]![0]!, matrix[1]![1]!, matrix[1]![2]!],
    [matrix[2]![0]!, matrix[2]![1]!, matrix[2]![2]!],
  ];
}

export function PixelPlayground({
  config: rawConfig,
  locale,
  disabled,
  reducedMotion,
  onWorkChange,
}: AiSimWidgetPlayerProps) {
  const config = rawConfig as StudentPixelPlaygroundConfig;
  const t = useTranslations("student.play.aiSim.pixelPlayground");

  const reportWork = useStableCallback(onWorkChange);

  // ── Explore panel state ──────────────────────────────────────────────
  const [selectedImageId, setSelectedImageId] = useState(config.images[0]!.id);
  const selectedImage = config.images.find((i) => i.id === selectedImageId) ?? config.images[0]!;
  const [resolutionIndex, setResolutionIndex] = useState(0);
  const resolution = config.resolutions[resolutionIndex] ?? config.resolutions[0]!;
  const [greyscaleOn, setGreyscaleOn] = useState(false);
  const [edgesOn, setEdgesOn] = useState(false);
  const [kernel, setKernel] = useState<number[][]>(() => EDGE_DETECTION_KERNEL.map((row) => [...row]));

  const { grid: baseGrid, status: baseStatus } = usePixelGrid(selectedImage.src);
  const resGrid = useMemo(
    () => (baseGrid ? downsampleRGB(baseGrid, resolution, resolution) : null),
    [baseGrid, resolution],
  );
  const greyGrid = useMemo(() => (resGrid ? greyscaleGrid(resGrid) : null), [resGrid]);
  const edgeGrid = useMemo(
    () => (greyGrid ? convolve3x3(greyGrid, toKernel3x3(kernel)) : null),
    [greyGrid, kernel],
  );

  const setKernelCell = (row: number, col: number, value: number) => {
    setKernel((current) => current.map((r, ri) => (ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r)));
  };
  const resetKernel = () => setKernel(EDGE_DETECTION_KERNEL.map((row) => [...row]));

  // ── Mystery rounds state ─────────────────────────────────────────────
  const [rounds, setRounds] = useState<Record<string, string>>({});
  const allAnswered = config.rounds.every((round) => rounds[round.id]);

  useEffect(() => {
    const work: PixelPlaygroundWork = { rounds };
    reportWork(work, allAnswered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rounds, allAnswered]);

  const pickRound = (roundId: string, imageId: string) => {
    if (disabled) return;
    setRounds((current) => ({ ...current, [roundId]: imageId }));
  };

  return (
    <div className="flex flex-col gap-8">
      {/* ── Explore panel ── */}
      <section className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-ink-muted">{t("exploreIntro")}</p>

        <div className="flex flex-wrap gap-2">
          {config.images.map((image) => (
            <button
              key={image.id}
              type="button"
              disabled={disabled}
              onClick={() => setSelectedImageId(image.id)}
              aria-pressed={selectedImageId === image.id}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-lg border-2 bg-surface-raised px-2 py-1.5 text-start transition-colors disabled:pointer-events-none disabled:opacity-60",
                selectedImageId === image.id
                  ? "border-brand bg-brand/10"
                  : "border-border-token hover:bg-surface-sunken",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- decorative thumbnail from a same-origin static SVG/PNG set */}
              <img src={image.src} alt="" aria-hidden="true" className="size-8 rounded object-contain" />
              <span className="text-sm font-semibold text-ink">{resolveLocalized(image.name, locale)}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-start gap-6">
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              {t("realPicture")}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element -- same-origin static asset, natural (non-pixelated) rendering for comparison */}
            <img
              src={selectedImage.src}
              alt={resolveLocalized(selectedImage.name, locale)}
              className="size-24 rounded-lg border border-border-token bg-surface-sunken object-contain p-2"
            />
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">
              {t("whatComputerSees")}
            </span>
            {baseStatus === "ready" ? (
              <PixelCanvas
                key={`${selectedImageId}-${resolution}-${greyscaleOn}-${edgesOn}`}
                rgbGrid={edgesOn ? null : greyscaleOn ? null : resGrid}
                greyGrid={edgesOn ? edgeGrid : greyscaleOn ? greyGrid : null}
                greyOffset={edgesOn ? 128 : 0}
                size={EXPLORE_DISPLAY}
                label={t("pixelGridLabel", { resolution })}
                animate={!reducedMotion}
              />
            ) : (
              <div
                className="grid place-items-center rounded-lg border border-border-token bg-surface-sunken text-sm text-ink-muted"
                style={{ width: EXPLORE_DISPLAY, height: EXPLORE_DISPLAY }}
              >
                {baseStatus === "error" ? t("loadError") : t("loadingImage")}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="pixel-resolution" className="text-sm font-semibold text-ink">
            {t("resolutionLabel", { resolution })}
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-muted">{t("resolutionDetailed")}</span>
            <input
              id="pixel-resolution"
              type="range"
              disabled={disabled}
              min={0}
              max={config.resolutions.length - 1}
              step={1}
              value={resolutionIndex}
              onChange={(event) => setResolutionIndex(Number(event.target.value))}
              className="h-11 flex-1 accent-brand"
            />
            <span className="text-xs text-ink-muted">{t("resolutionBlocky")}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={disabled}
            aria-pressed={greyscaleOn}
            onClick={() => setGreyscaleOn((v) => !v)}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-lg border-2 px-4 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60",
              greyscaleOn ? "border-brand bg-brand/10 text-ink" : "border-border-token bg-surface-raised text-ink hover:bg-surface-sunken",
            )}
          >
            {t("greyscaleToggle")}
          </button>
          <button
            type="button"
            disabled={disabled}
            aria-pressed={edgesOn}
            onClick={() => setEdgesOn((v) => !v)}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-lg border-2 px-4 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60",
              edgesOn ? "border-brand bg-brand/10 text-ink" : "border-border-token bg-surface-raised text-ink hover:bg-surface-sunken",
            )}
          >
            {t("edgesToggle")}
          </button>
        </div>

        {edgesOn ? (
          <div className="flex flex-col gap-2 rounded-xl border-2 border-border-token bg-surface-raised p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-ink">{t("kernelHeading")}</h3>
              <button
                type="button"
                disabled={disabled}
                onClick={resetKernel}
                className="text-sm font-semibold text-brand hover:underline disabled:pointer-events-none disabled:opacity-60"
              >
                {t("kernelReset")}
              </button>
            </div>
            <div className="grid w-fit grid-cols-3 gap-1.5">
              {kernel.map((row, ri) =>
                row.map((value, ci) => (
                  <input
                    key={`${ri}-${ci}`}
                    type="number"
                    inputMode="numeric"
                    disabled={disabled}
                    aria-label={t("kernelCell", { row: ri + 1, col: ci + 1 })}
                    value={value}
                    onChange={(event) => setKernelCell(ri, ci, Number(event.target.value) || 0)}
                    className="size-11 rounded-md border border-border-token bg-surface-sunken text-center text-sm font-semibold text-ink disabled:opacity-60"
                  />
                )),
              )}
            </div>
          </div>
        ) : null}
      </section>

      {/* ── Mystery rounds ── */}
      <section className="flex flex-col gap-4">
        <h3 className="font-display text-sm font-bold text-ink">{t("roundsHeading")}</h3>
        <div className="flex flex-col gap-6">
          {config.rounds.map((round, index) => {
            const picked = rounds[round.id];
            return (
              <div key={round.id} className="flex flex-col gap-3 rounded-xl border-2 border-border-token bg-surface-raised p-4 sm:flex-row sm:items-center">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">
                    {t("roundLabel", { number: index + 1 })}
                  </span>
                  <MysteryRoundCanvas round={round} size={ROUND_DISPLAY} />
                </div>
                <div
                  role="radiogroup"
                  aria-label={t("roundLabel", { number: index + 1 })}
                  className="flex flex-1 flex-wrap gap-2"
                >
                  {config.images.map((image) => {
                    const checked = picked === image.id;
                    return (
                      <label
                        key={image.id}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-start transition-colors",
                          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand has-[:focus-visible]:ring-offset-2",
                          checked ? "border-brand bg-brand/10" : "border-border-token bg-surface-sunken hover:bg-surface-sunken/70",
                          disabled && "pointer-events-none opacity-90",
                        )}
                      >
                        <input
                          type="radio"
                          name={`pixel-round-${round.id}`}
                          checked={checked}
                          disabled={disabled}
                          onChange={() => pickRound(round.id, image.id)}
                          className="sr-only"
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element -- decorative thumbnail from a same-origin static SVG/PNG set */}
                        <img src={image.src} alt="" aria-hidden="true" className="size-8 rounded object-contain" />
                        <span className="text-sm font-semibold text-ink">{resolveLocalized(image.name, locale)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
