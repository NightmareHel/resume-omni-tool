# JobPilot Design System — Quartz & Marble (v2)

Derived with the taste-skill methodology (github.com/Leonxlnx/taste-skill).
Design read: *data-dense job-search dashboard for a single power user; calm
polished light quartz-and-marble language; Tailwind v4 tokens + Motion + Geist.*
Dials: `DESIGN_VARIANCE 4 · MOTION_INTENSITY 4 · VISUAL_DENSITY 6`.

## Tokens (app/globals.css — single source)

| Token | Value | Use |
|---|---|---|
| `--bg` / `bg-quartz` | `#f5f4f1` | page background (cool quartz, never cream) |
| `--surface` / `bg-surface` | `#fdfdfb` | standard cards |
| `--surface-raised` / `bg-raised` | `#ffffff` | premium slabs, toasts, modals |
| `--surface-sunken` / `bg-sunken` | `#edece7` | kanban tracks, input wells, skeletons |
| `--border` / `border-seam` | `#e0ddd6` | visible borders |
| `--border-subtle` / `border-hairline` | `#ebe9e3` | dividers |
| `--accent` / `bronze` | `#8a7a5c` | THE one accent (active nav, focus, links, hero stat) |
| `--accent-strong` / `bronze-strong` | `#6f6248` | accent hover/active text |
| `--text-primary` / `text-graphite` | `#1c1a17` | primary text, primary buttons |
| `--text-secondary` / `text-stone` | `#6d675e` | secondary text |
| `--text-muted` / `text-faint` | `#a8a196` | labels, placeholders, empty states |

**Theme lock:** light everywhere. No dark sections, no `prefers-color-scheme` flip.
**Radius lock:** `4px` (badges/chips) · `8px` (buttons/inputs/kanban cards) · `14px` (cards/tracks) · `full` (pills/dots). Nothing else.
**Shadows:** `shadow-card` only (tinted to bg hue). `.slab-inner` for polished insets. Never pure black.

## Semantic color maps — lib/ui.ts ONLY

All status/badge tints live in `lib/ui.ts` (SPONSOR_BADGE, STATUS_COLORS, STATUS_DOT,
JOB_STATUS_COLORS, SOURCE_LABELS, scoreText/scoreBadge, SEVERITY_COLORS, CLASS_COLORS,
BTN, MONO_LABEL, EASE). **Never define a local color map in a component** — that drift
caused the v1 badge mismatches. Tint recipe: `bg-{hue}/10 text-{hue}-800 ring-1 ring-{hue}/25`.
These are data encoding, not decoration; bronze appears in none of them.

## Recipes

- **Card:** `bg-surface border border-seam rounded-[14px] shadow-card` · hover `border-bronze/40`.
- **Premium slab:** outer `bg-sunken border border-seam p-1.5 rounded-[14px]`, inner `bg-raised slab-inner rounded-[8px]`. Stat cards, PDF frame, score circle.
- **Buttons (lib/ui BTN):** primary graphite slab (`active:scale-[0.98]`), secondary white + seam + hover bronze border, ghost stone→graphite. Focus ring bronze. Labels ≤3 words.
- **Inputs:** `bg-surface border-seam rounded-[8px] focus:border-bronze placeholder-faint`.
- **Mono label (signature):** `font-mono text-[11px] uppercase tracking-[0.14em] text-faint` — stat labels, kanban column heads, filter labels. Max 1 kicker per 3 sections.
- **Numbers:** always `tabular-nums`; big stats `font-mono`; bronze only on the dashboard hero stat.
- **Kanban:** `bg-sunken rounded-[14px] p-2` tracks, white `rounded-[8px]` cards, status = dot + mono label in column header.
- **Skeletons:** `bg-sunken animate-pulse` shaped like the final layout. Spinner only on the PDF iframe overlay.
- **Empty states:** icon circle + one plain sentence + optional CTA. `text-faint`.

## Motion

`motion/react` only. Shared ease `EASE = [0.16, 1, 0.3, 1]` (lib/ui.ts). Motivated motion only:
kanban `layoutId` springs (stiffness 400, damping 35), navbar `layoutId="nav-underline"` slide,
`active:scale-[0.98]` taps, dashboard marble-vein canvas (MarbleBackground — dashboard ONLY,
static under `useReducedMotion`). No scroll hijacks, no infinite loops, no GSAP.

## Hard rules (pre-flight)

1. Zero `zinc-*`, `emerald-*`, `violet-*` classes (grep before ship).
2. No em-dashes in UI copy.
3. No local color maps in components.
4. Only the 4/8/14/full radius scale.
5. Contrast AA: graphite-on-white and all `-800` tint text pass; verify anything new.
6. `npx tsc --noEmit` clean.
7. Functional changes never ride along with design changes.
