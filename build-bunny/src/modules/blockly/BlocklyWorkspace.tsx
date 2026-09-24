"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { BlockSvg, Connection, WorkspaceSvg } from "blockly/core";
import * as ArabicMessages from "blockly/msg/ar";
import * as EnglishMessages from "blockly/msg/en";
import { Blockly } from "./blockly-core";
import { BUNNY_HAT_BLOCK, registerBunnyBlocks, type BlockLocale } from "./blocks";
import { workspaceToJson } from "./serialization";
import { BunnyTheme } from "./theme";
import type { BlockRef } from "./serialization";

/**
 * The student block editor (m3 contract): Zelos renderer, BunnyTheme,
 * flyout toolbox built from the level payload with per-block instance
 * limits, RTL-aware, imperative getWorkspaceJson for Run. Import this with
 * next/dynamic ssr:false — Blockly needs a real DOM to render.
 *
 * Beyond dragging, the handle exposes undo/redo, delete-selected and
 * addBlock — the tap-to-add path that lets a child build a program without
 * a single drag (BlockPalette), which is also how keyboard and switch users
 * reach every block.
 */

/** What the player's toolbar needs to know to enable its buttons. */
export interface WorkspaceEditState {
  canUndo: boolean;
  canRedo: boolean;
  /** The selected block, when it is one the student may build on. */
  selected: { type: string; emptyMouth: boolean } | null;
  /** Instances of each block type currently on the canvas. */
  counts: Record<string, number>;
}

export interface BlocklyWorkspaceHandle {
  getWorkspaceJson(): Record<string, unknown>;
  undo(): void;
  redo(): void;
  /** Deletes the selected block (healing the stack). False if none. */
  deleteSelected(): boolean;
  /**
   * Adds a block WITHOUT dragging: after the selected block, inside its
   * empty mouth if it has one, else at the end of the program. False when
   * the toolbox limit for that type is already reached.
   */
  addBlock(type: string): boolean;
}

/** Student-stripped BLOCK_CODING payload surface the editor needs. */
export interface BlocklyWorkspacePayload {
  toolbox: BlockRef[];
  startWorkspace?: unknown;
}

export interface BlocklyWorkspaceProps {
  payload: BlocklyWorkspacePayload;
  initialWorkspaceJson?: unknown;
  locale: BlockLocale;
  rtl: boolean;
  readOnly?: boolean;
  /** Fired on every meaningful edit with fresh workspace JSON — debounce in
   * the caller (autosave contract lives player-side). */
  onChange: (workspaceJson: Record<string, unknown>) => void;
  /** Block to light up during playback; null clears the highlight. */
  highlightBlockId?: string | null;
  /**
   * A block snapped into a program ("place") or was deleted ("remove") —
   * the student's own gestures only, for sound effects.
   */
  onBlockGesture?: (kind: "place" | "remove") => void;
  /** Undo/redo availability, selection and per-type counts, after every change. */
  onEditState?: (state: WorkspaceEditState) => void;
  ref?: Ref<BlocklyWorkspaceHandle>;
}

/**
 * The block the child is working on: Blockly's own selection, or — because
 * Blockly's selection follows keyboard focus and vanishes the moment a
 * button outside the canvas is tapped (Run, Add block, Ask Robo Bunny) —
 * the block they selected last, as long as it still exists. It is cleared
 * only by an explicit deselect (tapping the canvas background).
 */
function selectedBlock(workspace: WorkspaceSvg, lastId: string | null): BlockSvg | null {
  const selected = Blockly.getSelected();
  if (
    selected instanceof Blockly.BlockSvg &&
    selected.workspace === workspace &&
    !selected.isInFlyout
  ) {
    return selected;
  }
  if (lastId) {
    const remembered = workspace.getBlockById(lastId);
    if (remembered instanceof Blockly.BlockSvg && !remembered.isInFlyout) return remembered;
  }
  return null;
}

/** Fallback when a level ships no startWorkspace: just the locked hat. */
const HAT_ONLY_WORKSPACE = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: BUNNY_HAT_BLOCK,
        id: "start",
        x: 24,
        y: 24,
        deletable: false,
        movable: false,
      },
    ],
  },
};

export default function BlocklyWorkspace({
  payload,
  initialWorkspaceJson,
  locale,
  rtl,
  readOnly = false,
  onChange,
  highlightBlockId = null,
  onBlockGesture,
  onEditState,
  ref,
}: BlocklyWorkspaceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<WorkspaceSvg | null>(null);
  // Latest-callback refs so a new inline callback never forces a re-inject.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onGestureRef = useRef(onBlockGesture);
  onGestureRef.current = onBlockGesture;
  const onEditStateRef = useRef(onEditState);
  onEditStateRef.current = onEditState;
  const limitsRef = useRef<Record<string, number>>({});
  // The last block the child selected (see selectedBlock).
  const lastSelectedRef = useRef<string | null>(null);

  const reportEditState = (workspace: WorkspaceSvg) => {
    const counts: Record<string, number> = {};
    for (const block of workspace.getAllBlocks(false)) {
      counts[block.type] = (counts[block.type] ?? 0) + 1;
    }
    const selected = selectedBlock(workspace, lastSelectedRef.current);
    const mouth = selected?.getInput("DO")?.connection ?? null;
    onEditStateRef.current?.({
      canUndo: workspace.getUndoStack().length > 0,
      canRedo: workspace.getRedoStack().length > 0,
      selected: selected
        ? { type: selected.type, emptyMouth: mouth !== null && mouth.targetBlock() === null }
        : null,
      counts,
    });
  };

  useImperativeHandle(ref, () => ({
    getWorkspaceJson() {
      const workspace = workspaceRef.current;
      return workspace ? workspaceToJson(workspace) : {};
    },
    undo() {
      workspaceRef.current?.undo(false);
    },
    redo() {
      workspaceRef.current?.undo(true);
    },
    deleteSelected() {
      const workspace = workspaceRef.current;
      const block = workspace ? selectedBlock(workspace, lastSelectedRef.current) : null;
      if (!block || !block.isDeletable()) return false;
      lastSelectedRef.current = null;
      block.dispose(true);
      return true;
    },
    addBlock(type: string) {
      const workspace = workspaceRef.current;
      if (!workspace) return false;
      const limit = limitsRef.current[type];
      if (limit !== undefined && workspace.getBlocksByType(type, false).length >= limit) {
        return false;
      }
      const hat = workspace
        .getTopBlocks(false)
        .find((block) => block.type === BUNNY_HAT_BLOCK) as BlockSvg | undefined;
      const anchor = selectedBlock(workspace, lastSelectedRef.current);

      // One undo step for the whole insertion.
      Blockly.Events.setGroup(true);
      try {
        const block = workspace.newBlock(type);
        block.initSvg();
        block.render();

        let target: Connection | null = null;
        if (block.outputConnection) {
          // A sensor: plug it into the selected block's empty condition slot.
          const slot = anchor?.getInput("CONDITION")?.connection ?? null;
          target = slot && !slot.targetBlock() ? slot : null;
          if (target) target.connect(block.outputConnection);
        } else if (block.previousConnection) {
          if (anchor) {
            const mouth = anchor.getInput("DO")?.connection ?? null;
            target = mouth && !mouth.targetBlock() ? mouth : anchor.nextConnection;
          } else if (hat) {
            let last: BlockSvg = hat;
            while (last.getNextBlock()) last = last.getNextBlock() as BlockSvg;
            target = last.nextConnection;
          }
          // Connecting into an occupied slot inserts the block and re-attaches
          // what was there below it — Blockly handles the splice.
          if (target) target.connect(block.previousConnection);
        }
        if (!target) {
          // Nowhere to snap: drop it beside the program, still selected.
          const origin = hat?.getRelativeToSurfaceXY() ?? { x: 24, y: 24 };
          block.moveBy(origin.x + 40, origin.y + 120);
        }
        // Select the new block. Blockly's selection glow is tied to DOM
        // focus, and a block selected while a button holds focus keeps its
        // glow after the next one is selected — so the others are cleared
        // by hand, or three blocks end up looking selected at once.
        for (const other of workspace.getAllBlocks(false)) {
          if (other !== block && other instanceof Blockly.BlockSvg) other.removeSelect();
        }
        block.select();
        lastSelectedRef.current = block.id;
        workspace.scrollBoundsIntoView(block.getBoundingRectangle());
      } finally {
        Blockly.Events.setGroup(false);
      }
      return true;
    },
  }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Blockly chrome (context menus, tooltips) follows the app locale; the
    // bb_* block labels come from our own message map in blocks.ts.
    Blockly.setLocale(
      (locale === "ar" ? ArabicMessages : EnglishMessages) as unknown as Record<
        string,
        string
      >,
    );
    registerBunnyBlocks(locale);

    const maxInstances: Record<string, number> = {};
    for (const entry of payload.toolbox) {
      if (entry.limit !== undefined) maxInstances[entry.type] = entry.limit;
    }
    limitsRef.current = maxInstances;
    // Fingers are less precise than a mouse: start a touch device a little
    // zoomed in so blocks and their snap targets are bigger.
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    const workspace = Blockly.inject(host, {
      renderer: "zelos",
      theme: BunnyTheme,
      rtl,
      readOnly,
      toolbox: {
        kind: "flyoutToolbox",
        contents: payload.toolbox.map((entry) => ({
          kind: "block",
          type: entry.type,
        })),
      },
      maxInstances,
      media: "/blockly-media/",
      sounds: false,
      trashcan: !readOnly,
      zoom: { controls: true, wheel: false, pinch: true, startScale: coarse ? 1.15 : 1 },
      move: { scrollbars: true, drag: true, wheel: true },
    });
    workspaceRef.current = workspace;

    // Blockly fires events on a deferred queue, so the initial load would
    // otherwise reach the change listener attached below — disable events
    // around it; the student's own edits are what onChange reports.
    Blockly.Events.disable();
    try {
      Blockly.serialization.workspaces.load(
        ((initialWorkspaceJson ??
          payload.startWorkspace ??
          HAT_ONLY_WORKSPACE) as Record<string, unknown>),
        workspace,
      );
    } finally {
      Blockly.Events.enable();
    }

    const listener = (event: {
      isUiEvent: boolean;
      type: string;
      newParentId?: string;
      oldParentId?: string;
      newElementId?: string | null;
    }) => {
      if (event.type === Blockly.Events.SELECTED) {
        // Remember a newly selected block. A deselect is only honoured when
        // it is the child's own doing — a tap on the canvas background, which
        // leaves keyboard focus inside the workspace. Blockly 13 also drops
        // the selection when focus LEAVES the canvas (a tapped block has DOM
        // focus, and opening the block palette or any dialog blurs it); that
        // is not a decision to build somewhere else, so the block is kept.
        if (event.newElementId) {
          lastSelectedRef.current = event.newElementId;
        } else if (hostRef.current?.contains(document.activeElement)) {
          lastSelectedRef.current = null;
        }
        reportEditState(workspace);
        return;
      }
      if (event.isUiEvent) return;
      if (event.type === Blockly.Events.FINISHED_LOADING) return;
      if (event.type === Blockly.Events.BLOCK_MOVE && event.newParentId) {
        onGestureRef.current?.("place");
      } else if (event.type === Blockly.Events.BLOCK_DELETE) {
        onGestureRef.current?.("remove");
      }
      onChangeRef.current(workspaceToJson(workspace));
      reportEditState(workspace);
    };
    workspace.addChangeListener(listener);
    reportEditState(workspace);

    const resizeObserver = new ResizeObserver(() => {
      Blockly.svgResize(workspace);
    });
    resizeObserver.observe(host);

    return () => {
      resizeObserver.disconnect();
      workspace.removeChangeListener(listener);
      workspaceRef.current = null;
      workspace.dispose();
    };
    // payload identity is stable for a level; locale/rtl/readOnly flips
    // rebuild the editor (Blockly cannot re-skin in place).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, rtl, readOnly, payload]);

  useEffect(() => {
    workspaceRef.current?.highlightBlock(highlightBlockId ?? null);
  }, [highlightBlockId]);

  return (
    <div
      ref={hostRef}
      // Blockly measures its host: the parent panel owns the actual size.
      // `isolate` gives Blockly its own stacking context: its flyout and
      // scrollbars carry z-index 20–30, which otherwise escaped into the
      // player and painted OVER the failure banner — on a portrait tablet
      // the flyout scrollbar sat on "Try again" and swallowed the tap.
      className="isolate h-full min-h-40 w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]"
    />
  );
}
