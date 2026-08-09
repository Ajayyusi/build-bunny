# Build Bunny UI

Token layers (see `src/app/globals.css`):

1. **Primitives** (`--bb-*`) — raw palette/radius/shadow values. Never referenced by components.
2. **Semantic slots** (`--color-surface`, `--color-ink`, `--radius-lg`, `--font-display`…) — remapped by `[data-theme="play"]` (student) and `[data-theme="pro"]` (staff); `:root` defaults to Play. The attribute works on any subtree.
3. **Tailwind mapping** (`@theme inline`) — components write utilities only: `bg-surface text-ink border-border-token rounded-lg font-display shadow-soft`.

Conventions:

- No raw hex, no `--bb-*` references, no theme conditionals in components — both themes must work purely via tokens.
- Logical properties only (`ps-*`, `pe-*`, `ms-*`, `me-*`, `start/end`, `text-start`) so RTL works untouched; physical top/bottom is fine.
- All user-facing strings arrive via props, translated at the call site (`ToastProvider` requires `dismissLabel`; `Dialog` takes `closeLabel`; `DataTable` takes `emptyMessage`).
- `Button` defaults to `type="button"`; pass `type="submit"` in forms. `size="lg"` (44px) is the minimum on student surfaces (also on `Input`/`Select`).
- `text-ink-faint` is below AA contrast by design — decorative/disabled text only.
- Focus rings are global (`:focus-visible` in base styles); don't suppress outlines.
- Wrap the app once in `<ToastProvider>`; apply `fontVariables(locale)` (from `src/ui/fonts.ts`) on `<html>` next to `data-theme`.
- Honest states: pair every list with `EmptyState`/`ErrorState`/`Skeleton` — no dead ends.
