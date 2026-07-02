# Architecture — JobPilot (ResumeOmniTool v2)

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ResumeOmniTool (Next.js 16)                      │
│                                                                         │
│  EXISTING (frozen)                 NEW PAGES                            │
│  ├─ / (resume optimizer)           ├─ /jobs (job board + scores)        │
│  ├─ /api/parse-resume              ├─ /pipeline (kanban tracker)        │
│  ├─ /api/analyze-jd                ├─ /profile (master profile)         │
│  └─ /api/rewrite                   └─ /emails (reply inbox)             │
│                                                                         │
│  NEW API ROUTES                                                         │
│  ├─ /api/jobs                      ├─ /api/profile                      │
│  ├─ /api/jobs/[id]                 ├─ /api/applications                 │
│  ├─ /api/jobs/[id]/tailor          ├─ /api/applications/[id]            │
│  ├─ /api/scrape                    ├─ /api/applications/[id]/submit     │
│  ├─ /api/score                     └─ /api/emails, /api/emails/sync     │
└───────────────────────┬──────────────────────┬──────────────────────────┘
                        │                      │
               ┌────────▼────────┐   ┌─────────▼──────────┐
               │  SQLite DB      │   │  Worker Processes   │
               │  better-sqlite3 │   │  (Node.js via tsx)  │
               │  + Drizzle ORM  │   │                     │
               │  data/jobs.db   │   │  worker/scraper.ts  │
               │                 │   │  └─ cron: 6h        │
               │  Tables:        │   │  worker/apply.ts    │
               │  jobs           │   │  └─ Playwright pool │
               │  applications   │   │  worker/email-sync  │
               │  email_threads  │   │  └─ cron: 30min     │
               │  profile        │   └─────────────────────┘
               │  scrape_runs    │
               └────────▲────────┘
                        │
               ┌────────┴────────┐
               │  Scrapers       │
               │  lib/scrapers/  │
               │                 │
               │  greenhouse.ts  │
               │  lever.ts       │
               │  ashby.ts       │
               │  workday.ts     │
               │  custom.ts      │
               └─────────────────┘
```

## Data Flow

```
Scrape (6h cron)
  └─► lib/scrapers/*.ts
        └─► INSERT INTO jobs (deduplicated by source+external_id)
              └─► scrape_runs log

Score (manual or post-scrape batch)
  └─► GET profile FROM profile WHERE id='default'
        └─► GET description FROM jobs WHERE id=?
              └─► Groq: fit_score, fit_grade, fit_summary
                    └─► UPDATE jobs SET fit_score, fit_grade, fit_summary

Tailor (per job, from /jobs page)
  └─► GET profile + job description
        └─► lib/claude.ts: analyzeKeywordGap() + rewriteResume()
              └─► INSERT INTO applications (status='draft', resume_text, cover_letter)

Apply (human approves from /pipeline)
  └─► PATCH /api/applications/[id]/submit
        └─► worker/apply.ts: Playwright form-fill
              └─► screenshot written to data/screenshots/
                    └─► UPDATE applications SET status='submitted', screenshot_path

Email sync (30min cron)
  └─► Gmail MCP: search_threads is:unread newer_than:2d
        └─► Groq: classify reply/rejection/interview/offer/other
              └─► fuzzy match company → applications
                    └─► INSERT INTO email_threads + UPDATE applications.status
```

## Component Ownership

| Layer | Owns | Does NOT own |
|---|---|---|
| Next.js API routes | HTTP request/response | Business logic, DB writes from workers |
| lib/scrapers/*.ts | HTTP to job boards, normalization | DB writes (scrapeAll in lib/scrapers/index.ts does that) |
| lib/scrapers/index.ts | DB inserts, scrape_runs log | Scheduling |
| worker/scraper.ts | node-cron schedule | Any scraping logic |
| worker/apply.ts | Playwright form-fill, screenshots | Application creation |
| worker/email-sync.ts | Gmail polling, classification | Application status writes (delegates to DB via update) |
| lib/db.ts | SQLite singleton, WAL mode | Schema definition |
| lib/schema.ts | Drizzle schema | DB connection |
| lib/ids.ts | jobId() hash function | Nothing else |
| lib/claude.ts | All Groq API calls | DB, scraping, email |

## Worker Process Design

Workers run as separate Node.js processes (not inside Next.js). They share the same `data/jobs.db` file. SQLite WAL mode allows concurrent reads. Workers only write; web app only reads (with one exception: the `/api/emails/sync` route triggers the email worker via a flag in scrape_runs).

**Starting workers in development:**
```bash
npm run dev          # starts Next.js + both workers via concurrently
npm run dev:worker   # scraper only
```

**In production (Mac Mini via PM2):**
```
pm2 start ecosystem.config.js
```

## Frozen Files (Do Not Modify)

These files exist and work. New phases may import from them but must not change them:

- `app/page.tsx`
- `app/layout.tsx`
- `app/globals.css`
- `app/api/parse-resume/route.ts`
- `app/api/analyze-jd/route.ts`
- `app/api/rewrite/route.ts`
- `lib/ats-rules.ts`
- `lib/parse-pdf.ts`
- `lib/parse-docx.ts`
- `lib/claude.ts`
- `components/ScoreMeter.tsx`
- `components/StepIndicator.tsx`
- `components/ATSAudit.tsx`
- `components/KeywordGap.tsx`
- `components/ResumeRewriter.tsx`

## Integration Points (New ↔ Existing)

| New code | Uses existing | How |
|---|---|---|
| /api/jobs/[id]/tailor | lib/claude.ts | Direct import of analyzeKeywordGap(), rewriteResume() |
| /api/score | lib/claude.ts | New scoreJob() function added to claude.ts (only addition allowed) |
| /jobs page | ScoreMeter.tsx | Reuse for fit_score display |
| All new API routes | lib/db.ts | getDb() singleton |

## Scaling Notes (Mac Mini context)

- SQLite is adequate for single-user, local deployment. No connection pool needed.
- WAL mode handles concurrent reads from web + workers without contention.
- Playwright worker capped at 2 concurrent browsers to avoid memory pressure.
- Groq API calls are rate-limited naturally by manual trigger (scoring) and 30-min cron (email).
