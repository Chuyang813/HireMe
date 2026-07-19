# 002 — Add press feedback to every pressable element

- **Status**: DONE
- **Commit**: 6105fb4
- **Severity**: HIGH
- **Category**: Physicality & origin
- **Estimated scope**: ~9 files, one-line className/CSS edits each

## Problem

No pressable element in the app has an `:active` state. Buttons give zero physical feedback on press — the interface doesn't feel like it's listening. Depends on plan 001 (motion tokens).

```css
/* src/app/globals.css:133 — current .btn */
transition: background 150ms;
```

```tsx
// src/components/ui/Button.tsx:6 — current base
"inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-4 text-[13px] font-medium disabled:opacity-50 disabled:pointer-events-none transition-colors";
```

## Target

`transform: scale(0.97)` on `:active` (0.95 for icon-only buttons), with transform included in the transition at 150ms using the strong `--ease-out` from plan 001. Tailwind's bare `transition` utility (a curated list incl. colors + transform, NOT `transition: all`) replaces `transition-colors` where transform must animate.

```css
/* target — globals.css .btn */
.btn {
  /* … */
  transition: background 150ms, border-color 150ms, transform 150ms var(--ease-out);
}
.btn:active:not(:disabled) {
  transform: scale(0.97);
}
```

Tailwind pattern for JSX buttons: replace `transition-colors` with `transition duration-150 ease-out active:scale-[0.97]` (text/label buttons) or `… active:scale-95` (icon-only buttons ≤ 32px).

## Repo conventions to follow

- Global button variants live in `globals.css:121-177` (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`).
- JSX-level buttons use inline Tailwind classes; `src/components/ui/Button.tsx` is the shared component.

## Steps

1. `src/app/globals.css:133`: change `transition: background 150ms;` to `transition: background 150ms, border-color 150ms, transform 150ms var(--ease-out);` and add a `.btn:active:not(:disabled) { transform: scale(0.97); }` rule after the `.btn:disabled` rule.
2. `src/components/ui/Button.tsx:6`: in `base`, replace `transition-colors` with `transition duration-150 ease-out active:scale-[0.97]`.
3. `src/app/page.tsx:61,86,92` (landing CTAs): add `active:scale-[0.98]`; on lines 61/86 replace `transition-opacity` with `transition duration-150 ease-out`; on line 92 replace `transition-colors` with `transition duration-150 ease-out`.
4. `src/components/MobileNav.tsx:18,50` (hamburger + close icon buttons): add `transition duration-150 ease-out active:scale-95`.
5. `src/components/LanguageSwitcher.tsx:67` (trigger): replace `transition-colors` with `transition duration-150 ease-out active:scale-[0.97]`.
6. `src/components/FeedbackButtons.tsx:43,67` (thumb icons): replace `transition-colors` with `transition duration-150 ease-out active:scale-95`.
7. `src/app/(app)/applications/ApplicationsView.tsx:133,147` (view toggles): after existing `transition`, add `duration-150 ease-out active:scale-95`.
8. `src/components/DeleteApplicationButton.tsx:26-27` (trigger, both variants): replace bare `transition` with `transition duration-150 ease-out active:scale-[0.97]`; lines 54 and 62 (cancel/confirm): add `transition duration-150 ease-out active:scale-[0.97]`.
9. `src/components/ResumePreviewButton.tsx:33` (trigger): add `transition duration-150 ease-out active:scale-[0.97]`; line 52 (close): add `transition duration-150 ease-out active:scale-95`.
10. `src/app/(app)/applications/[id]/WorkspaceTabs.tsx:1663` (desktop tab buttons): replace `transition-colors` with `transition duration-150 ease-out active:scale-[0.98]`.
11. `src/components/OnboardingChecklist.tsx:126,147` (CTA links): add `transition duration-150 ease-out active:scale-[0.97]`.
12. `src/components/DemoSection.tsx:384` (step pills): replace `transition-colors` with `transition duration-150 ease-out active:scale-[0.97]`.

## Boundaries

- Do NOT touch `StatusSelect.tsx` (native `<select>` — scale on press looks broken).
- Do NOT change markup/structure — className/CSS edits only.
- Do NOT add press feedback to plain text links in prose.

## Verification

- **Mechanical**: `npx tsc --noEmit` passes.
- **Feel check**: click and HOLD any primary button — it should visibly sink to 97% and spring back on release with no lag. Icon buttons sink slightly more (95%). Disabled buttons must NOT sink.
- **Done when**: every button listed above scales on `:active` and no hover color transitions broke.
