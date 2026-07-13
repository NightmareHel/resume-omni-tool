# JobPilot Handoff: 2026-07-11 (UI overhaul session)

Pick up here with fresh context. Read `docs/DESIGN-RULES.md` first: it defines the Quartz & Marble system all UI work must follow.

**Doc authority:** this file + git log are current. `CONTEXT.md` is STALE (ends at Session 6, pre-throughput-release, pre-overhaul); use it only for deep architecture history.

**Design methodology source (for any new layout/design work):** the full taste-skill lives at `c:/Users/likea/Desktop/BoardRoom/projects/personalweb-v2/.agents/skills/design-taste-frontend/SKILL.md` (origin: github.com/Leonxlnx/taste-skill). JobPilot dials: VARIANCE 4 / MOTION 4 / DENSITY 6, redesign-overhaul mode, IA and functionality preserved.

## State: Quartz & Marble UI overhaul

**Phase 1: reskin: COMPLETE and verified.**
Token system in `app/globals.css` (bg-quartz / bg-surface / bg-sunken / border-seam / text-graphite / text-stone / text-faint / bronze accent, radius 4/8/14). All semantic color maps consolidated in `lib/ui.ts` (SPONSOR_BADGE, STATUS_COLORS, STATUS_DOT, JOB_STATUS_COLORS, SOURCE_LABELS, scoreText/scoreBadge, SEVERITY_COLORS, CLASS_COLORS, BTN, MONO_LABEL, EASE): no component defines local color maps anymore. Pre-flight passed: zero zinc/emerald/violet classes, zero em-dashes, on-scale radii only, tsc clean, all 7 routes 200. `components/MarbleBackground.tsx` = graphite-vein canvas, mounted on dashboard only, static under reduced motion.

**Phase 2: layout recomposition (user-approved, 4 items): 3.5 of 4 done, UNVERIFIED.**

| Item | Status |
|---|---|
| Dashboard hero + action rail (`app/page.tsx`) | DONE: hero metric block, 3 stat cells, merged Flow panel (funnel + velocity), sticky right rail |
| Jobs ranked rows (`components/jobs/JobRow.tsx` NEW, `JobBoard.tsx`, `ManualJobsSection.tsx`, `app/jobs/page.tsx`) | DONE: dense rows, sticky filter bar (top-14), My Jobs is a collapsible slim strip; `JobCard.tsx` DELETED |
| Detail compact toolbar (`app/pipeline/[id]/page.tsx`) | DONE: h-12 single-row header; body now `h-[calc(100vh-104px)]` |
| Resume wizard left-rail steps | HALF: `components/StepIndicator.tsx` rewritten as vertical rail (horizontal on mobile), but `app/resume/page.tsx` still uses the old single-column layout |

## Immediate next steps (in order)

1. **Finish the wizard layout:** in `app/resume/page.tsx`, change `<main className="max-w-3xl mx-auto px-4 py-10 flex flex-col gap-10">` to a two-column grid: `max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-10 items-start`, wrap `<StepIndicator>` in `<aside className="lg:sticky lg:top-20">`, wrap the step sections in a `<div className="flex flex-col gap-10 min-w-0">`.
2. `npx tsc --noEmit` (must be clean).
3. Render-check all 7 routes on the dev server (port 3000; a server is likely already running: it hot-reloads).
4. User eyeballs the new layouts; expect tweak requests on hero sizing / rail width.
5. **Commit everything** (entire overhaul is uncommitted) and push to github.com/NightmareHel/jobpilot (gh credential helper works; the stored PAT does NOT have push rights).

## Background / unrelated state

- **Backlog scorer** (`scripts/score-backlog.ts`) was launched earlier: may still be running or done; check `SELECT count(*) FROM jobs WHERE fit_score IS NOT NULL`. Score worker also in PM2 config (not running locally unless started).
- Throughput release (scoring worker, Mark Submitted flow, Gmail sync code, interview prep, velocity, 152 scrape targets) shipped in commit `d97bffa`. Gmail sync still needs Sid to create a Google Cloud OAuth client + run `scripts/gmail-auth.ts`.
- DB: ~3,773 entry-level jobs; senior roles are dropped at scrape time (`isSeniorForNewGrad`).
- Dev server quirk: only ONE `next dev` per project dir; kill the old one before starting fresh (EADDRINUSE otherwise). If Turbopack panics with "Next.js package not found", delete `.next` and restart.

## Rules that bind future UI work

- All tints/status colors from `lib/ui.ts`: never local maps.
- Radius scale 4/8/14/full only. Light theme only. One accent (bronze): semantic tints are data encoding, not decoration.
- No em-dashes in UI strings. Numbers always `tabular-nums`.
- No functional changes mixed into design changes.
