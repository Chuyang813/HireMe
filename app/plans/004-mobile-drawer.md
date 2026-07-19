# 004 — Mobile nav drawer: fade the overlay, use the drawer curve

- **Status**: DONE
- **Commit**: 6105fb4
- **Severity**: MEDIUM
- **Category**: Easing & duration / Interruptibility
- **Estimated scope**: 1 file (`src/components/MobileNav.tsx`)

## Problem

Two issues in `src/components/MobileNav.tsx`:

1. The overlay is conditionally rendered — it pops to full 40% black instantly while the drawer slides, and vanishes instantly on close (lines 32-37):

```tsx
{open && (
  <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setOpen(false)} />
)}
```

2. The drawer itself uses the weak default `ease` at 200ms (line 41):

```tsx
"fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-background shadow-lg transition-transform duration-200 md:hidden",
```

## Target

Overlay stays mounted and cross-fades with the drawer — fully interruptible in both directions (transitions retarget mid-motion; conditional render cannot). Both use the iOS drawer curve `cubic-bezier(0.32, 0.72, 0, 1)` (Tailwind utility `ease-drawer` from plan 001) at 300ms — within the 200–500ms drawer budget. Reduced motion snaps.

```tsx
/* target — overlay, always mounted */
<div
  className={[
    "fixed inset-0 z-40 bg-black/40 md:hidden transition-opacity duration-300 ease-drawer motion-reduce:transition-none",
    open ? "opacity-100" : "pointer-events-none opacity-0",
  ].join(" ")}
  onClick={() => setOpen(false)}
  aria-hidden="true"
/>

/* target — drawer className line */
"fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-background shadow-lg transition-transform duration-300 ease-drawer motion-reduce:transition-none md:hidden",
```

## Repo conventions to follow

- The drawer already uses the always-mounted + `-translate-x-full` pattern (line 42) — the overlay should mirror it.
- `ease-drawer` utility comes from the `@theme` block added in plan 001.

## Steps

1. `src/components/MobileNav.tsx:32-37`: replace the `{open && (…)}` overlay block with the always-mounted version from Target (keep the `onClick`; add `aria-hidden="true"`).
2. Line 41: replace `transition-transform duration-200` with `transition-transform duration-300 ease-drawer motion-reduce:transition-none`.

## Boundaries

- Do NOT touch the nav links or header inside the drawer (press feedback is plan 002).
- Do NOT add drag-to-close gestures.

## Verification

- **Mechanical**: `npx tsc --noEmit` passes.
- **Feel check** (narrow the viewport below `md`): open the menu — overlay and drawer ease in together over 300ms with a fast start and soft landing. Tap the overlay mid-open: the drawer must reverse smoothly from its current position, never jump. Closed state: overlay must not intercept clicks (`pointer-events-none`).
- **Done when**: overlay fades instead of popping and rapid open/close spamming never stutters.
