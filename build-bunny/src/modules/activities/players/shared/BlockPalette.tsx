"use client";

import { useTranslations } from "next-intl";

import type { WorkspaceEditState } from "@/modules/blockly/BlocklyWorkspace";
import { BLOCK_COLOR_BY_TYPE } from "@/modules/blockly/colors";
import type { BlockRef } from "@/modules/blockly/serialization";
import { Button, Dialog, cn } from "@/ui";

/**
 * Tap-to-add blocks: the accessible alternative to drag-and-drop.
 *
 * Dragging a Blockly block is the one interaction in the game that needs
 * fine motor control, a working pointer and sight of the drop target. A
 * child with a shaky hand, a switch, a screen reader or a laggy tablet
 * touchscreen can instead open this palette and tap the block they want;
 * BlocklyWorkspace.addBlock snaps it after the selected block (inside its
 * mouth if it has an empty one) or at the end of the program, and selects
 * it, so the next tap chains on naturally. The palette says where the next
 * block will land before they choose.
 *
 * Every entry is a 56px button coloured like the block it adds, with the
 * remaining count when the level limits that block.
 */

// Same colours as the blocks themselves (blockly/colors.ts).
const blockTone = (type: string): React.CSSProperties => ({
  backgroundColor: BLOCK_COLOR_BY_TYPE[type] ?? "var(--color-brand)",
  color: "#ffffff",
});

interface BlockPaletteProps {
  open: boolean;
  onClose: () => void;
  toolbox: BlockRef[];
  editState: WorkspaceEditState | null;
  /** Returns false when the block could not be added (limit reached). */
  onAdd: (type: string) => boolean;
  /** Where the block will land, when the caller knows better than the
   * selection does (a Learn step always fills its one gap). */
  placementText?: string;
}

export function BlockPalette({ open, onClose, toolbox, editState, onAdd, placementText }: BlockPaletteProps) {
  const t = useTranslations("student.play.tools");
  const tBlocks = useTranslations("student.play.blockNames");
  if (!open) return null;

  const label = (type: string) => (tBlocks.has(type) ? tBlocks(type) : type);
  const selected = editState?.selected ?? null;
  const placement = placementText
    ? placementText
    : selected
    ? selected.mouth === "ELSE"
      ? t("paletteInsideElse", { block: label(selected.type) })
      : selected.emptyMouth
      ? t("paletteInside", { block: label(selected.type) })
      : t("paletteAfter", { block: label(selected.type) })
    : t("paletteEnd");

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("paletteTitle")}
      closeLabel={t("close")}
      footer={
        <Button variant="secondary" size="lg" onClick={onClose}>
          {t("close")}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-muted">{t("paletteHint")}</p>
        <p role="status" className="rounded-lg bg-surface-sunken px-3 py-2 text-sm font-semibold text-ink">
          {placement}
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {toolbox.map((entry) => {
            const used = editState?.counts[entry.type] ?? 0;
            const remaining = entry.limit === undefined ? null : Math.max(0, entry.limit - used);
            const exhausted = remaining === 0;
            return (
              <li key={entry.type}>
                <button
                  type="button"
                  disabled={exhausted}
                  onClick={() => {
                    if (onAdd(entry.type)) onClose();
                  }}
                  style={blockTone(entry.type)}
                  className={cn(
                    "flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-4 text-start font-display text-base font-extrabold shadow-[0_4px_0_rgb(0_0_0_/_0.22)] transition-transform active:translate-y-0.5 disabled:opacity-50",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className="text-lg leading-none">
                      +
                    </span>
                    {label(entry.type)}
                  </span>
                  {remaining !== null ? (
                    <span className="rounded-full bg-surface-raised/25 px-2 py-0.5 text-xs font-semibold">
                      {exhausted ? t("limitReached") : t("remaining", { count: remaining })}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Dialog>
  );
}
