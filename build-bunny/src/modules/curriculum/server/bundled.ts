import "server-only";

import { bundle } from "../../../../content";

import type { ImportBundle } from "./import";

/**
 * The compiled-in content bundle (content/index.ts) surfaced to the import
 * wizard's "Load bundled content" action and the import CLI. ContentBundle
 * is structurally identical to ImportBundle (both are fixture arrays), so
 * this is a plain widening, not a cast.
 */
export function getBundledContent(): ImportBundle {
  return bundle;
}
