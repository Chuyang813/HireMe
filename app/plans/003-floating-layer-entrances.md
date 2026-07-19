# 003 — Animate floating-layer entrances (dropdown, popover, modal)

- **Status**: DONE
- **Commit**: 6105fb4
- **Severity**: HIGH
- **Category**: Physicality & origin / Missed opportunities
- **Estimated scope**: 4 files (globals.css + 3 components)

## Problem

Three floating layers mount with **no transition at all** — they teleport onto screen, which reads as broken:

```tsx
// src/components/LanguageSwitcher.tsx:75-78 — current (conditional render, zero animation)
{open && (
  <div role="menu"
    className="absolute right-0 top-[calc(100%+0.375rem)] z-30 w-56 overflow-hidden rounded-md border border-border bg-background shadow-sm">
```

```tsx
// src/components/DeleteApplicationButton.tsx:45-46 — current
{confirming && (
  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-64 rounded-md border border-border bg-background p-3 text-left shadow">
```

```tsx
// src/components/ResumePreviewButton.tsx:42-47 — current (overlay + panel, zero animation)
{open && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" …>
    <div className="relative flex h-[90vh] w-full max-w-3xl flex-col rounded-lg bg-background shadow-md overflow-hidden">
```

They also use static-card shadows (`shadow-sm` / `shadow`) — floating layers get no elevation separation from cards sitting on the page.

## Target

CSS-only entry animation via `@starting-style` (elements are conditionally rendered, so `@starting-style` fires on insertion; exits stay instant, which is correct for dismissal). Popovers scale from their trigger corner (`top right` — both are right-anchored below their trigger); the modal is exempt and stays centered per the modal exemption rule. Reduced motion keeps the fade, drops the movement.

```css
/* target — add to src/app/globals.css */
/* ── Motion: floating layers ─────────────────────────── */
.popover-enter {
  transform-origin: top right;
  transition: opacity 150ms var(--ease-out), transform 150ms var(--ease-out);
  @starting-style {
    opacity: 0;
    transform: scale(0.97) translateY(-2px);
  }
}

.modal-enter {
  transition: opacity 180ms var(--ease-out), transform 180ms var(--ease-out);
  @starting-style {
    opacity: 0;
    transform: scale(0.97);
  }
}

.overlay-enter {
  transition: opacity 180ms var(--ease-out);
  @starting-style {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .popover-enter,
  .modal-enter {
    transition-property: opacity; /* keep the fade, drop the movement */
  }
}
```

Shadow upgrade: floating layers use `shadow-[var(--shadow-float)]` (token from plan 001) instead of `shadow-sm`/`shadow`.

## Repo conventions to follow

- Component-level utility classes live in `globals.css` (e.g. `.card`, `.btn`, `.streaming`) — add the motion classes in the same style with a `/* ── … ── */` section header.
- Requires plan 001 (`--ease-out`, `--shadow-float`).

## Steps

1. Add the CSS block from Target to `src/app/globals.css` after the badge section.
2. `src/components/LanguageSwitcher.tsx:78`: append `popover-enter` to the menu className and replace `shadow-sm` with `shadow-[var(--shadow-float)]`.
3. `src/components/DeleteApplicationButton.tsx:46`: append `popover-enter` and replace `shadow` with `shadow-[var(--shadow-float)]`.
4. `src/components/ResumePreviewButton.tsx:44`: append `overlay-enter` to the fixed overlay className. Line 47: append `modal-enter` to the panel className.

## Boundaries

- Do NOT add exit animations (would require presence-management state; instant dismissal is acceptable).
- Do NOT change `transform-origin` on the modal — modals stay centered.
- Do NOT convert conditional renders to always-mounted.

## Verification

- **Mechanical**: `npx tsc --noEmit` passes.
- **Feel check**: open the language menu — it should fade + settle in from its top-right corner in ~150ms, snappy not floaty. In DevTools Animations panel at 10% speed, confirm the menu scales from the trigger corner, not from center. The preview modal fades in with the overlay; panel settles from 97%. Toggle Emulate `prefers-reduced-motion: reduce` (Rendering panel): layers still fade in, but no scale/translate movement.
- **Done when**: no floating layer pops in instantly at full opacity.
