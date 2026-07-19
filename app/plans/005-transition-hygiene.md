# 005 — Transition hygiene: progress bars, demo crossfade interruptibility

- **Status**: DONE
- **Commit**: 6105fb4
- **Severity**: MEDIUM
- **Category**: Performance / Interruptibility
- **Estimated scope**: 3 files

## Problem

1. Progress bars transition **all** properties when only width changes:

```tsx
// src/components/OnboardingChecklist.tsx:92 — current
className="h-full rounded-full bg-accent transition-all duration-500"
// src/app/(app)/applications/[id]/WorkspaceTabs.tsx:626 — current
className="h-full rounded-full transition-all duration-500"
```

2. The landing DemoSection crossfade uses weak `ease`, and `goTo` never cancels the pending hide-timeout — two rapid pill clicks queue two timeouts and the step double-advances:

```tsx
// src/components/DemoSection.tsx:340-347 — current
const goTo = useCallback((next: number) => {
  setVisible(false);
  setTimeout(() => {
    setStep(next);
    setVisible(true);
    if (next === 3) setOpenAccordion(0);
  }, 200);
}, []);

// DemoSection.tsx:425 — current
transition: "opacity 200ms ease, transform 200ms ease",
```

## Target

```tsx
// progress bars — both files
className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"   // OnboardingChecklist
className="h-full rounded-full transition-[width] duration-500 ease-out"             // WorkspaceTabs

// DemoSection — track and clear the pending timer (add useRef to the react import)
const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const goTo = useCallback((next: number) => {
  if (hideTimer.current) clearTimeout(hideTimer.current);
  setVisible(false);
  hideTimer.current = setTimeout(() => {
    setStep(next);
    setVisible(true);
    if (next === 3) setOpenAccordion(0);
  }, 200);
}, []);

// DemoSection panel style
transition: "opacity 200ms var(--ease-out), transform 200ms var(--ease-out)",
```

Also add `motion-reduce:transition-none` alongside the panel's Tailwind classes? The panel uses an inline `style` — instead, movement under reduced motion is only 6px; acceptable to keep. No change.

## Repo conventions to follow

- `ease-out` utility resolves to the strong curve from plan 001.
- `duration-500` on progress bars is intentional (state indication smoothing, not UI response — exempt from the 300ms budget).

## Steps

1. `src/components/OnboardingChecklist.tsx:92`: `transition-all duration-500` → `transition-[width] duration-500 ease-out`.
2. `src/app/(app)/applications/[id]/WorkspaceTabs.tsx:626`: `transition-all duration-500` → `transition-[width] duration-500 ease-out`.
3. `src/components/DemoSection.tsx`: add `useRef` to the react import; add the `hideTimer` ref and the `clearTimeout` guard in `goTo` per Target.
4. `src/components/DemoSection.tsx:425`: replace both `ease` keywords with `var(--ease-out)`.

## Boundaries

- Do NOT change the 500ms progress durations or the 200ms crossfade timing.
- Do NOT touch the auto-advance interval logic (lines 350-364).

## Verification

- **Mechanical**: `npx tsc --noEmit` passes.
- **Feel check**: on the landing page, rapidly click two different step pills — the demo must land on the last clicked step, never flash through an extra one. Progress bars still animate width smoothly.
- **Done when**: typecheck passes and rapid pill-clicking never double-advances.
