# JobPilot Design Rules

Source: derived from taste-skill (github.com/Leonxlnx/taste-skill, MIT).

## Color

- Background scale: zinc-950 (page) / zinc-900 (surface) / zinc-800 (raised)
- Single accent: emerald-500 for primary actions, links, active states
- No pure black (#000) in UI. Use zinc-950 minimum. No pure white (#fff).
- Tinted shadows: shadow-emerald-950/40 on accent elements, shadow-zinc-950/60 elsewhere
- Destructive: red-500 / red-950 background

## Typography

- All numbers: `tabular-nums` class always, `font-mono` for scores and counts
- Heading scale: text-2xl / text-xl / text-lg / text-base / text-sm
- Labels: text-xs uppercase tracking-wide text-zinc-400
- Body: text-sm text-zinc-200

## Radius

- One radius scale: rounded-lg (cards, inputs, buttons), rounded-xl (modals, large cards), rounded-full (badges, avatars)
- No mixing rounded-md and rounded-lg in the same component

## Cards

- Standard card: `bg-zinc-900 ring-1 ring-white/10 rounded-xl`
- Premium card (double-bezel): outer `bg-white/5 ring-1 ring-white/10 p-1.5 rounded-xl`, inner `bg-zinc-900/80 ring-1 ring-white/5 rounded-lg`
- Use double-bezel for: PDF iframe frame, dashboard stat cards, featured items
- Tinted inner glow on hover: `hover:ring-white/20 transition-all`

## Spacing

- Section gap: gap-8 or gap-10 between major sections
- Card internal padding: p-4 (standard), p-6 (large)
- Inline chip gap: gap-1.5 or gap-2

## Buttons

- Primary: `bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition-colors`
- Secondary: `bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-lg transition-colors`
- Ghost: `text-zinc-400 hover:text-zinc-100 transition-colors`
- Focus ring: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500`
- Disabled: `disabled:opacity-50 disabled:cursor-not-allowed`

## Loaders

- Skeleton loaders shaped like the final layout (not spinners)
- Use `animate-pulse bg-zinc-800 rounded` blocks matching content dimensions
- Never show a spinner for a layout that has known shape

## Empty States

- Composed: icon + heading + action button
- Use zinc-700 for empty state icons, zinc-500 for text
- Always offer a primary action (e.g., "Import a job", "Fill your profile")

## Animation

- Motion library (motion npm package) for layout animations
- Only animate `transform` and `opacity` — never layout properties directly
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` (spring-like, fast settle)
- Stagger: 60-80ms between list items
- `layoutId` on kanban cards for position-change animations
- Duration: 200-300ms max. No slow animations.

## Sponsorship Display

- confirmed / likely: emerald badge `bg-emerald-950 text-emerald-400 ring-1 ring-emerald-800`
- possible: yellow `bg-yellow-950 text-yellow-400 ring-1 ring-yellow-800`
- unknown: zinc `bg-zinc-800 text-zinc-400`
- unlikely: orange `bg-orange-950 text-orange-400 ring-1 ring-orange-800`
- blocked: red `bg-red-950 text-red-400 ring-1 ring-red-800`
- Always show `sponsor_evidence` in the title attribute (tooltip)

## Accessibility

- WCAG AA contrast on all text against its background
- Focus rings on all interactive elements
- No color-only information (pair color with text/icon)
