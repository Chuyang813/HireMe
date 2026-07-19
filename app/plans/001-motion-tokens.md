# 001 — Add strong motion tokens to the design system

- **Status**: DONE
- **Commit**: 6105fb4
- **Severity**: HIGH
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file (`src/app/globals.css`), ~15 lines

## Problem

`src/app/globals.css` defines color/shape/shadow tokens but **no motion tokens**. Every transition in the app falls back to the browser's weak built-in `ease` with ad-hoc durations (150ms, 200ms, 300ms, 500ms scattered across files). Built-in CSS easings lack the punch that makes motion feel intentional; the absence of tokens means every later fix would hand-type its own cubic-bezier.

```css
/* src/app/globals.css:34-41 — current: shape/shadow tokens exist, motion tokens do not */
  /* Shape */
  --radius: 6px;
  --radius-sm: 4px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
```

## Target

A Tailwind v4 `@theme` block (this project uses Tailwind v4 via `@import "tailwindcss"`) defining strong curves. Placing `--ease-*` in `@theme` both emits the CSS variables on `:root` AND makes `ease-out` / `ease-in-out` / `ease-drawer` Tailwind utilities use these curves:

```css
/* target — add after the existing `@theme inline { … }` block */
@theme {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);        /* strong ease-out for UI enter/exit */
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);    /* strong ease-in-out for on-screen movement */
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);     /* iOS-like drawer curve */
}
```

Also add a floating-layer shadow token to `:root` (used by plan 003):

```css
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  --shadow-float: 0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05);
  --card-shadow: var(--shadow-sm);
```

## Repo conventions to follow

- Tokens live in `:root` in `src/app/globals.css:4-42`; Tailwind theme mapping in the `@theme inline` block at `globals.css:44-58`. Static new tokens go in a plain `@theme` block (not `inline`, which is for referencing other vars).
- No `ease-out`/`ease-in-out` Tailwind utilities are currently used anywhere in `src/`, so overriding the defaults changes nothing retroactively — verified at commit 6105fb4.

## Steps

1. In `src/app/globals.css`, after the closing `}` of the `@theme inline` block (line 58), insert the `@theme` block from Target verbatim.
2. In the `:root` Shadows section (line 39-41), add the `--shadow-float` line from Target between `--shadow` and `--card-shadow`.

## Boundaries

- Do NOT change any existing token values.
- Do NOT touch any `.tsx` file.
- Do NOT add dependencies.

## Verification

- **Mechanical**: `npx tsc --noEmit` passes; `npm run build` (or `bash scripts/check.sh`) succeeds.
- **Feel check**: none yet — tokens are inert until consumed by plans 002-005.
- **Done when**: `var(--ease-out)` resolves in DevTools computed styles on `:root` and the `ease-drawer` Tailwind utility compiles.
