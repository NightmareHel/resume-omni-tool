# Redesign Existing Projects

Adapted from taste-skill (github.com/Leonxlnx/taste-skill, MIT License). Attribution required on derivative work.

## When to invoke

When asked to redesign, restyle, or apply a consistent design system to an existing project. The project's functions must remain unchanged — only visual and layout code is modified.

## Process

1. **Read DESIGN-RULES.md** in the project root (or docs/). This is the source of truth for this project's design system.
2. **Audit the current state**: list pages and components that need updating, note inconsistencies.
3. **Apply systematically**: tackle one component at a time, never mix redesign with functional changes.
4. **Verify contrast**: WCAG AA minimum on all text/background combinations.
5. **Check TypeScript**: `npx tsc --noEmit` before committing.

## Rules

- Function unchanged. No logic, API, or state changes.
- One radius scale. No mixing rounded-md and rounded-xl in the same component.
- All numbers use tabular-nums. Scores, counts, dates all get `font-mono tabular-nums`.
- Skeleton loaders shaped like final layout — never a spinner for a known-shape component.
- No pure black or pure white. zinc-950 / zinc-50 at extremes.
- Emerald accent only. No introducing new accent colors.
- Animations: transform/opacity only via Motion. cubic-bezier(0.16,1,0.3,1), 200-300ms max.
- Double-bezel card recipe for premium surfaces:
  ```
  outer: bg-white/5 ring-1 ring-white/10 p-1.5 rounded-xl
  inner: bg-zinc-900/80 ring-1 ring-white/5 rounded-lg
  ```

## Commit format

`<page/component>: apply design system (no functional changes)`

Never bundle functional and visual changes in the same commit.
