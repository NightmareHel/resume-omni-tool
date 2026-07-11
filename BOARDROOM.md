# JobPilot

**Description:** Self-hosted AI job application pipeline built for Sid's job search. Scrapes 150+ sources, classifies H-1B sponsorship likelihood against DOL/USCIS filing data, auto-scores fit, tailors a one-page XYZ-format resume + cover letter per job, tracks the pipeline on a kanban, generates interview prep, and syncs recruiter emails from Gmail.

**Status:** Active — throughput phase (applying), feature-complete for v1

**Key Dates:**
- August 24, 2026 — Mac Mini deployment before SAP start (see docs/DEPLOY.md)
- November 2026 — job search deadline

## Tech Stack
- Next.js 16 (App Router), TypeScript, Tailwind CSS 4
- SQLite (better-sqlite3) via Drizzle ORM
- Groq API (llama-3.3-70b) for scoring/tailoring/classification — provider-agnostic client, Anthropic swap deferred
- Playwright for PDF generation and scraping
- node-cron + PM2 workers: scraper (6h), score (10min), email-sync (30min)

## Pages
- Dashboard — stats, funnel, velocity metrics, action queue
- Jobs — scraped board with sponsor/entry filters, score + tailor per job
- Pipeline — kanban; per-application detail with PDF preview, editors, quality critique, interview prep
- Resume — standalone resume analysis wizard
- Profile — master profile (source of truth for tailoring)
- Emails — classified recruiter threads from Gmail sync

## Workflow (manual-submit posture)
Tailor → review draft at /pipeline/[id] → download resume + cover PDFs → submit by hand on the job site → Mark Submitted → replies tracked via email sync.

## Next Steps
- Clear scoring backlog; sustain 5 submissions/day
- Gmail OAuth client setup (user prereq) → live email sync
- Mac Mini cutover before Aug 24

*Reviewed 2026-07-11*
