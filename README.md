# JobPilot

A self-hosted AI job application pipeline. Scrapes 150+ job sources, classifies every posting's H-1B sponsorship likelihood against real government filing data, scores fit against your profile, generates a tailored one-page ATS resume and cover letter per job, and tracks everything through a kanban pipeline with Gmail reply syncing and AI interview prep.

Built because commercial auto-apply tools ($100+/month) spray irrelevant applications and can't answer the one question that matters for international candidates: *will this employer actually sponsor?*

## Architecture

```
                        ┌──────────────────────────────────────────────┐
                        │                  SCRAPERS (cron 6h)          │
                        │  Greenhouse · Lever · Ashby · Workday ·      │
                        │  SmartRecruiters · Workable · curated        │
                        │  new-grad feeds · remote APIs · manual URL   │
                        └──────────────────┬───────────────────────────┘
                                           │ classify at insert
                        ┌──────────────────▼───────────────────────────┐
                        │  SPONSORSHIP + SENIORITY ENGINE              │
                        │  JD-text verdicts (tiered regex, negation    │
                        │  guards) × employer H-1B history from        │
                        │  DOL LCA + USCIS disclosure files.           │
                        │  Senior roles (3+ yrs) dropped at the gate.  │
                        └──────────────────┬───────────────────────────┘
                                           │
      ┌──────────────┐    ┌────────────────▼──────────────┐   ┌─────────────────┐
      │ SCORE WORKER │───▶│        SQLite (Drizzle)       │◀──│ EMAIL SYNC      │
      │ (cron 10min) │    │  jobs · applications ·        │   │ Gmail OAuth,    │
      │ LLM fit 0-100│    │  profile · sponsor_history ·  │   │ LLM classify,   │
      │ + penalties  │    │  email_threads                │   │ match to app    │
      └──────────────┘    └────────────────┬──────────────┘   └─────────────────┘
                                           │
                        ┌──────────────────▼───────────────────────────┐
                        │  TAILOR (SSE streaming)                      │
                        │  keyword gap + XYZ bullet rewrite + cover    │
                        │  letter → deterministic one-page template    │
                        │  → headless-Chromium fit loop → PDF          │
                        └──────────────────┬───────────────────────────┘
                                           │
                        ┌──────────────────▼───────────────────────────┐
                        │  PIPELINE (kanban + detail workspace)        │
                        │  PDF preview · editors · AI critique ·       │
                        │  interview prep · velocity dashboard         │
                        └──────────────────────────────────────────────┘
```

## What makes it different

**Sponsorship engine.** Every job gets a verdict (`confirmed / likely / possible / unknown / unlikely / blocked`) from two signals: tiered regex classification of the JD text itself (hard blocks like "US citizens only" or ITAR, soft boilerplate like "must be authorized," positive signals like "we sponsor H-1B"), cross-referenced with the employer's actual H-1B filing history ingested from DOL LCA disclosure files and USCIS Data Hub CSVs (~190k certified LCAs across recent fiscal years). Staffing-agency filings are blocklisted so an Infosys LCA never credits a client posting. Blocked jobs are capped at a fit score of 20 and can never be un-blocked by the LLM.

**One-page resume engine.** The AI only rewrites bullet wording (Google XYZ format, index-aligned to the profile — it structurally cannot drop a section or invent a role). A deterministic template owns the layout, and a headless-Chromium measure loop adds or trims content until the page is 95%+ full at exactly one page.

**Score-before-apply.** A background worker scores every posting against the profile (entry-level and sponsor-friendly first), so the board is a ranked queue, not a firehose.

**Local-first.** SQLite, no cloud, no accounts, no data leaving the machine. PM2 keeps the workers alive on a Mac Mini.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · SQLite via Drizzle ORM · Playwright (PDF generation + scraping) · node-cron + PM2 · Groq `llama-3.3-70b` (provider-agnostic client; scoring/tailoring/classification/prep)

## Quickstart

```bash
git clone https://github.com/NightmareHel/jobpilot.git
cd jobpilot
npm install
npx playwright install chromium

# .env.local
#   GROQ_API_KEY=gsk_...            (required — free tier works)
#   GMAIL_CLIENT_ID=...             (optional — email sync)
#   GMAIL_CLIENT_SECRET=...
npm run db:migrate
npm run dev            # web on :3000

# workers (separate terminals, or pm2 start ecosystem.config.js)
npx tsx worker/scraper.ts      # scrape every 6h
npx tsx worker/score.ts        # score backlog every 10min
npx tsx worker/email-sync.ts   # gmail sync every 30min (after scripts/gmail-auth.ts)

# one-offs
npx tsx scripts/score-backlog.ts             # clear the scoring backlog now
npx tsx scripts/ingest-sponsors.ts dol 2026 1  # refresh H-1B filing data
```

## Pipeline workflow

1. Scrapers fill the board; senior roles and non-US locations are dropped at the gate, sponsorship verdicts attached.
2. The score worker ranks everything against your profile.
3. Pick a job → **Tailor** streams a keyword-gap analysis, XYZ resume rewrite, and cover letter; a draft application lands on the kanban.
4. Review at `/pipeline/[id]`: live PDF preview, text editors, AI critique, re-tailor.
5. Download PDFs, submit on the employer site, hit **Mark Submitted**.
6. Email sync classifies recruiter replies (`reply / rejection / interview / offer`) and matches them to applications; the Prep tab generates role-specific interview questions with STAR guidance from your real background.
7. The dashboard tracks weekly submission velocity, response rate, and days-to-submit.

## Disclaimer

Personal tool, tuned for one user's job search (entry-level SWE/AI, US, OPT/H-1B constraints). No warranty. Sponsorship verdicts are statistical signals from public filing data and JD text — verify with the employer before relying on them.
