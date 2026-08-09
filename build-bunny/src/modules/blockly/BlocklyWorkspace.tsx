"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { WorkspaceSvg } from "blockly/core";
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
 */

export interface BlocklyWorkspaceHandle {
  getWorkspaceJson(): Record<string, unknown>;
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
  ref?: Ref<BlocklyWorkspaceHandle>;
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
  ref,
}: BlocklyWorkspaceProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<WorkspaceSvg | null>(null);
  // Latest-callback ref so a new inline onChange never forces a re-inject.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useImperativeHandle(ref, () => ({
    getWorkspaceJson() {
      const workspace = workspaceRef.current;
      return workspace ? workspaceToJson(workspace) : {};
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
      zoom: { controls: true, wheel: false, pinch: true, startScale: 1 },
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

    const listener = (event: { isUiEvent: boolean; type: string }) => {
      if (event.isUiEvent) return;
      if (event.type === Blockly.Events.FINISHED_LOADING) return;
      onChangeRef.current(workspaceToJson(workspace));
    };
    workspace.addChangeListener(listener);

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
      className="h-full min-h-64 w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]"
    />
  );
}
