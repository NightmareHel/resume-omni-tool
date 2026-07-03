# JobPilot — Session Context & Roadmap

*Last updated: 2026-07-02 (Session 3)*

This file exists so any future session can pick up exactly where we left off without re-reading the entire codebase. It covers what was built, what works, what is broken, the full gap list, and the roadmap to production.

---

## What This Project Is

**JobPilot** (also called ResumeOmniTool in some places — name inconsistency is a known issue) is a self-hosted AI job application pipeline built for Sid's personal job search. It is NOT a SaaS product — it is a private tool running on a Mac Mini, connecting to Sid's Gmail, and targeting specific companies in the tri-state area and remote roles.

The core flow is:

```
Scrape jobs from 23 companies (+ manually add any URL) → Score each against profile → Tailor resume per job → Auto-submit via Playwright → Track replies in email inbox → Move through kanban pipeline
```

Everything runs locally. SQLite database, Node.js workers, Next.js frontend. No cloud deployment. No multi-user. No billing.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 App Router, React 19, Tailwind CSS 4 |
| Database | SQLite (better-sqlite3, WAL mode) via Drizzle ORM |
| AI | Groq API (llama-3.3-70b-versatile) via OpenAI SDK |
| Scraping | Greenhouse API, Lever API (paginated), Ashby API, Workday CXS API |
| Apply | Playwright (Chromium, headless: false) |
| PDF Gen | Playwright (Chromium, headless: true) via `lib/resume-pdf.ts` |
| Workers | node-cron (scraper: 6h, email-sync: 30min, apply: 2min poll) |
| Process | PM2 (web + scraper + email-sync; apply worker NOT in PM2 — manual only) |
| Auth | None — local only |

**Important:** `lib/claude.ts` uses Groq/Llama, NOT Claude/Anthropic. The `@anthropic-ai/sdk` package is installed but never imported. All AI calls hit `https://api.groq.com/openai/v1` using the OpenAI SDK. The plan is to switch to Anthropic in Phase 3 — see roadmap.

---

## Directory Overview

```
resume-omni-tool/
├── app/                    # Next.js pages + API routes
│   ├── page.tsx            # Home: 4-step resume analysis wizard (upload → ATS → gap → rewrite)
│   ├── jobs/page.tsx       # Job board: My Jobs (manual) section + Scraped Jobs section
│   ├── pipeline/page.tsx   # Kanban application tracker
│   ├── emails/page.tsx     # Email inbox (read-only, classification badges)
│   ├── profile/page.tsx    # Master profile editor
│   └── api/                # All API routes (see below)
├── components/
│   └── jobs/
│       ├── JobBoard.tsx        # Scraped jobs grid + filters + scrape/score-all buttons
│       ├── JobCard.tsx         # Individual job card (score badge, actions)
│       ├── JobFilters.tsx      # Filter/sort bar (persists to localStorage)
│       └── ManualJobsSection.tsx  # My Jobs: URL input + custom job grid
├── lib/                    # Core logic: db, AI client, scrapers, formatters, ATS rules
│   ├── claude.ts           # All AI functions (Groq via OpenAI SDK)
│   ├── resume-pdf.ts       # Playwright-based PDF generation for apply worker
│   ├── application-state.ts # State machine: TRANSITIONS + TERMINAL_STATUSES
│   ├── profile-formatter.ts # Profile → AI prompt text
│   ├── scrapers/
│   │   ├── _http.ts        # fetchJson, matchesFilter, matchesTitleFilter (with seniority exclusion), withRetry
│   │   ├── greenhouse.ts
│   │   ├── lever.ts
│   │   ├── ashby.ts
│   │   └── workday.ts
│   └── ids.ts              # jobId (SHA-256 hash), uuid
├── worker/
│   ├── apply.ts            # Apply automation: PDF gen → form fill → screenshot
│   ├── scraper.ts          # 6h cron scrape
│   └── email-sync.ts       # 30min cron (STUB — no real Gmail pull)
├── scripts/                # sanity-check.ts test suite, setup-mac-mini.sh
├── config/scrapers.json    # 23 scraper targets
├── data/jobs.db            # SQLite database (fresh scrape as of 2026-07-02, 233 jobs)
├── drizzle/migrations/     # Single migration: all 5 tables
└── docs/                   # API-CONTRACT, ARCHITECTURE, DATA-MODEL, DECISIONS, TEST-PLAN, HANDOFF-2026-07-02
```

---

## Database Schema

5 tables, single migration (`0000_cheerful_triathlon.sql`):

**`jobs`** — scraped and manually imported postings
- `id`: SHA-256 of `source+external_id` (dedup key)
- `source`: greenhouse | lever | ashby | workday | **custom** (manually imported via URL)
- `external_id`: for scraped jobs = ATS-assigned ID; for custom jobs = the URL itself
- `title`, `company`, `location`, `remote` (0/1), `url`, `description`, `salary_min`, `salary_max`, `posted_at`, `scraped_at`
- `fit_score` (0-100), `fit_grade` (A-F), `fit_summary` (one-sentence AI note)
- `status`: new | reviewed | queued | applied | archived
- Unique on `(source, external_id)` and on `url`

**`applications`** — one per job the user tailored/applied to
- `id`: UUID
- `job_id`: FK to jobs (CASCADE delete)
- `status`: draft | pending | submitted | replied | screen | interview | offer | rejected | withdrawn | **manual_required** (new terminal state — apply worker aborts here when custom questions are detected)
- `resume_text`: tailored resume (plain text sections, double-newline separated)
- `cover_letter`: AI-generated cover letter (plain text, 3-4 paragraphs). Generated by tailor route as of Session 3. Was always null before.
- `form_data`: JSON blob (schema column exists, never written)
- `screenshot_path`: Playwright screenshot after form fill
- `notes`: free-text
- Enforced state machine in `lib/application-state.ts`

**`profile`** — single row (id = 'default')
- Contact: full_name, email, phone, location, linkedin_url, github_url, portfolio_url
- Content: summary, experience (JSON array), education (JSON array), skills (JSON array)
- Targeting: target_roles (JSON array), target_locations (JSON array), salary_min

**`email_threads`** — classified Gmail threads
- Links to `applications` and `jobs` via FK
- `classification`: reply | rejection | interview | offer | other
- `action_required`: 0/1
- `read`: 0/1

**`scrape_runs`** — audit log
- `started_at`, `completed_at`, `sources` (JSON), `jobs_found`, `jobs_new`, `status`, `error`

---

## API Routes

| Method | Route | What it does |
|---|---|---|
| POST | `/api/parse-resume` | Parse PDF/DOCX + run deterministic ATS audit |
| POST | `/api/analyze-jd` | Keyword gap analysis between resume text and JD |
| POST | `/api/rewrite` | AI section-by-section resume rewrite |
| POST | `/api/score` | Score a job (by jobId) against profile, writes back to DB |
| GET | `/api/scrape` | Latest scrape_run row |
| POST | `/api/scrape` | Trigger background scrape, returns runId |
| GET | `/api/profile` | Read profile |
| PUT | `/api/profile` | Upsert profile |
| GET | `/api/jobs` | List jobs (filter: source, status, minScore, search, excludeCustom; sort: scraped_at, score_desc, score_asc; paginated) |
| GET | `/api/jobs/[id]` | Single job |
| PATCH | `/api/jobs/[id]` | Update job status |
| POST | `/api/jobs/[id]/tailor` | AI tailor resume + generate cover letter + create draft application |
| **POST** | **`/api/jobs/import`** | **NEW: Playwright-fetch a URL, extract title/company/description, store as source=custom** |
| GET | `/api/applications` | List applications |
| POST | `/api/applications` | Create manual draft |
| GET | `/api/applications/[id]` | Single application + job |
| PATCH | `/api/applications/[id]` | Update status (enforces state machine) or notes |
| POST | `/api/applications/[id]/submit` | Mark as queued (stub — apply worker does the actual work) |
| **GET** | **`/api/applications/[id]/resume.pdf`** | **NEW: Generate and stream PDF of tailored resume** |
| GET | `/api/emails` | List email threads |
| POST | `/api/emails/sync` | Trigger sync (stub in standalone mode) |

---

## AI Functions (lib/claude.ts)

All use Groq llama-3.3-70b-versatile. JSON extracted via regex from model output except cover letter (plain text).

- `analyzeKeywordGap(resumeText, jdText)` → `{ mustHave, niceToHave, found, missing, suggested, score }`
- `rewriteResume(resumeText, jdText)` → `{ sections: [{ name, original, rewritten, changes }], summary }`
- `scoreJob(profileText, jobDescription)` → `{ score: 0-100, grade: A-F, summary: string }`
- **`generateCoverLetter(profileText, jobTitle, company, jdText)`** → `string` (plain text, 3-4 paragraphs, ~300 words). System+user message pattern. temp=0.4, max_tokens=700. Added Session 3.

---

## Scraper Targets (config/scrapers.json)

23 companies configured. All filter to eng/AI titles, tri-state + remote locations.

| Company | ATS |
|---|---|
| Anthropic, OpenAI, Databricks, W&B, Palantir, MongoDB, ~~Snowflake~~, Stripe, Figma, ~~Ramp~~, Brex, Cockroach Labs, Notion, Duolingo, Benchling, Anduril | Greenhouse |
| Cohere, Scale AI, Hugging Face | Lever |
| ~~Perplexity~~, Linear, Vercel, Replit | Ashby |

**Known broken slugs (return 404 — need fixing):**
- Ramp: `rampfinancial` → try `ramp` or check current Greenhouse slug
- Snowflake: `snowflake` → verify on boards-api.greenhouse.io
- Perplexity: `perplexity-ai` → verify on Ashby (may have moved ATS)

Location filter: new york, new jersey, philadelphia, boston (remote auto-passes).
Title include filter: engineer, developer, software, ai, ml, scientist, backend, fullstack.

**Seniority exclusion filter (NEW — Session 3):** `matchesTitleFilter()` in `lib/scrapers/_http.ts` rejects any title containing: `senior`, `sr.`, `staff`, `principal`, `lead`, `manager`, `director`, `head`, `vp`, `vice president`, `architect`, `distinguished`, `intern`, `co-op`. Applied globally in all 4 scrapers before the include filter.

**Current DB state:** Fresh scrape performed 2026-07-02 after full wipe. 233 clean jobs (all pass seniority exclusion filter). Old jobs with senior titles have been purged.

---

## Workers

**`worker/scraper.ts`** — runs every 6 hours via node-cron. Calls `scrapeAll` against all 23 targets in parallel. Included in PM2.

**`worker/email-sync.ts`** — runs every 30 minutes. STUB in standalone mode. The actual Gmail pull requires the Boardroom Claude Code session with Gmail MCP tools active. Contains `classifyThread` and `matchToApplication` functions that are fully functional (tested in sanity-check phase 6) but the data ingestion path does not work without MCP.

**`worker/apply.ts`** — polls every 2 minutes for `pending` applications. NOT in PM2 — must be started manually. As of Session 3, fully functional for Greenhouse, Lever, and Ashby. Workday still skipped. See apply worker details below.

### Apply Worker — How It Works Now (Post Phase 1)

1. Poll DB for `status = 'pending'` applications every 2 minutes
2. Guard: skip if no profile or no resume_text
3. Generate PDF via `generateResumePDF(app.resume_text, profile)` from `lib/resume-pdf.ts`
4. Write PDF to `os.tmpdir()` as `resume-{timestamp}.pdf`
5. Branch by `job.source`:
   - `greenhouse`: `fillGreenhouse()` — targets `#first_name`, `#last_name`, `#email`, `#phone`, `input[type="file"]`
   - `lever`: `fillLever()` — enters iframe via `page.frameLocator('iframe').first()`, uses `aria-label*` / `autocomplete` / `name*` selectors. Detects custom questions by comparing total visible text inputs against known standard selectors — aborts to `manual_required` if any unrecognized fields found.
   - `ashby`: `fillAshby()` — uses `_systemfield_name`, `_systemfield_email`, `_systemfield_phone` with aria-label fallback. Same custom question detection.
   - `workday`: skip (update notes only)
6. On `ManualRequiredError`: sets `status = 'manual_required'`, saves screenshot
7. On other error: logs error, saves error message to notes
8. On success: sets `status = 'submitted'`, saves screenshot
9. `finally`: always deletes temp PDF

### Resume PDF Generation (`lib/resume-pdf.ts`)

- Single-column ATS-safe HTML template. No tables, no CSS grid.
- Font: Arial 10.5pt body, 18pt name header, 12pt section headers with `border-bottom: 1px solid #000`
- Flex for layout, bullet points via `<ul><li>` (never dashes)
- Margins: 0.5in all sides (set both in `@page` CSS and in Playwright margin param)
- Playwright headless Chromium renders to Letter format PDF
- `GET /api/applications/[id]/resume.pdf` streams the buffer inline

---

## What Works

- Full resume wizard on home page (parse → ATS audit → keyword gap → AI rewrite)
- Profile editor with experience/education/skills, dirty tracking, save confirmation
- Job scraping from Greenhouse, Lever, Ashby targets with seniority exclusion
- **My Jobs section** — paste any URL, Playwright auto-fetches title/company/description, stores as `source=custom`, full score/tailor/pipeline support
- Fit scoring per job (score written back to DB)
- Job board with filtering, sorting by score, search, sticky filters (localStorage)
- Batch "Score All" button (sequential with 500ms gaps)
- Resume tailoring per job: AI generates tailored resume text AND cover letter in parallel, creates draft application
- PDF generation from tailored resume text (Playwright headless, ATS-safe template)
- **Apply worker functional for Greenhouse, Lever, Ashby**: PDF upload, correct form selectors, custom question detection → manual_required
- Tailor loading state, scrape polling with completion toast, global toast system
- Pipeline kanban (9 columns, status transitions enforced by state machine, notes, resume preview)
- All error paths are guarded (API routes return proper JSON errors, client uses defensive `.catch()`)
- TypeScript clean (`npx tsc --noEmit` passes)
- Sanity check script phases 1-6 (offline DB, Greenhouse live scrape, API endpoints, AI tailor, state machine, email classification)
- PM2 ecosystem config for web + scraper + email-sync

---

## What Is Broken or Incomplete

### Critical (blocks real use)

**1. Email sync is a stub**
`POST /api/emails/sync` and `worker/email-sync.ts` do not actually pull Gmail in standalone mode. The Gmail integration is architecturally coupled to the Boardroom MCP session. Fix requires Gmail OAuth flow (google-auth-library + refresh token in `.env.local`). This is Phase 2.

**2. /api/applications/[id]/submit is a no-op**
It validates status but does not update the DB or trigger anything. The apply worker picks up `pending` items on its own 2-minute poll. The "Approve & Queue" button in the UI works correctly (calls PATCH to move status to `pending` first), but the subsequent submit call does nothing useful.

**3. Three broken scraper slugs**
Ramp (`rampfinancial`), Snowflake (`snowflake`), Perplexity (`perplexity-ai`) all return 404 during scrape. These companies return no jobs. Need to find correct slugs and update `config/scrapers.json`.

### Non-Critical (UX / data gaps)

**4. Keyword gap not persisted**
`POST /api/jobs/[id]/tailor` returns the keyword gap analysis but never stores it. It's lost on page reload. Should be stored in the `applications` table or a new `tailor_analysis` JSON column. (Phase 5)

**5. No resume/cover letter edit endpoint**
After a draft application is created, there is no API to update `resume_text` or `cover_letter`. Only status and notes can be changed via PATCH. (Phase 5)

**6. Apply worker not in PM2**
`ecosystem.config.js` has `web`, `scraper`, `email-sync` — but not `apply`. User decided to keep it manual for now. To add: `pm2 start "npx tsx worker/apply.ts" --name apply` + `pm2 save`.

**7. Score thresholds inconsistent**
`ScoreMeter.tsx` colors green at 80, amber at 60. `JobCard.tsx` score badge colors green at 75, amber at 55. Should be unified.

**8. PDF ATS detection partial**
Table, multi-column, and header/footer ATS checks are detected from DOCX via mammoth. For PDF uploads, these checks always pass regardless of actual content. `lib/parse-pdf.ts` has no structural analysis.

**9. Naming inconsistency**
Navbar says "JobPilot". `app/layout.tsx` metadata says "ResumeOmniTool". `lib/claude.ts` uses Groq not Claude. Should settle on "JobPilot".

**10. No Workday targets**
`lib/scrapers/workday.ts` exists and works but there are no Workday entries in `config/scrapers.json`. Workday scraper returns `description: null` (detail page requires Playwright — not worth it now).

**11. Ashby HTML in description**
Ashby API sometimes returns HTML in `descriptionPlain`. No stripping applied. Raw HTML shows in job description view.

**12. Manual job import timing**
The `POST /api/jobs/import` route uses Playwright with `waitUntil: 'networkidle'` which can take 5-15 seconds. Next.js API route default timeout may cause issues for slow pages. If pages time out, the error is surfaced to the user as "Could not load URL".

---

## Mac Mini Deployment Plan

The project has `scripts/setup-mac-mini.sh` for one-shot setup.

**Steps to go live:**
1. SSH into Mac Mini
2. Clone repo
3. Set `GROQ_API_KEY` in `.env.local`
4. Run `bash scripts/setup-mac-mini.sh` — installs, migrates, builds, starts PM2
5. Manually start apply worker when needed: `npx tsx worker/apply.ts`
6. Access via local IP or Tailscale for remote access from laptop

**What you need before going live:**
- Fix 3 broken scraper slugs (Ramp, Snowflake, Perplexity)
- Decide on email sync approach (MCP session vs. standalone OAuth)
- Verify Lever slugs for Scale AI and Hugging Face return real results

---

## Roadmap

### Phase 1 — Make apply actually work ✅ COMPLETE (Session 3)
- [x] `lib/resume-pdf.ts`: Playwright `page.pdf()` resume renderer, ATS-safe single-column HTML
- [x] `GET /api/applications/[id]/resume.pdf`: streams PDF bytes
- [x] `worker/apply.ts`: generates PDF in processApplication, passes path to fillers, cleans up in finally
- [x] `fillLever()`: iframe detection, aria-label selectors, custom question detection → manual_required
- [x] `fillAshby()`: _systemfield_* selectors, custom question detection → manual_required
- [x] `generateCoverLetter()` in `lib/claude.ts`, wired into tailor route in parallel with gap+rewrite
- [x] `manual_required` added as terminal state in `lib/application-state.ts`
- [ ] Apply worker added to PM2 ecosystem config (user chose to keep manual — defer)

### Phase 2 — Standalone email sync
- [ ] Add Gmail OAuth (google-auth-library + nodemailer or googleapis)
- [ ] Store refresh token in `.env.local`
- [ ] Rewrite `worker/email-sync.ts` to use Gmail API directly, no MCP dependency
- [ ] Wire `matchToApplication` to actually update `email_threads.application_id` when a match is found

### Phase 3 — Switch AI layer to Anthropic
- [ ] Rename `lib/claude.ts` to `lib/ai.ts`
- [ ] Replace Groq calls with Anthropic SDK (claude-sonnet-4-6 or claude-haiku-4-5 for cost)
- [ ] Update `.env.local` to use `ANTHROPIC_API_KEY` instead of `GROQ_API_KEY`
- [ ] Haiku for scoring (cheap, fast), Sonnet for tailoring (quality matters)
- [ ] Streaming responses for tailor endpoint (currently blocks 5-10s with no feedback)
- [ ] Add token usage logging

### Phase 4 — Expand job sources
- [ ] Fix broken slugs: Ramp, Snowflake, Perplexity
- [ ] Verify Lever slugs for Scale AI (scaleai) and Hugging Face (huggingface)
- [ ] Add more NYC/remote AI companies as scraper targets
- [ ] Add "remote only" filter option to job board UI

### Phase 5 — Pipeline intelligence
- [ ] Persist keyword gap result in DB (new JSON column on applications)
- [ ] Add resume edit endpoint (PATCH resume_text and cover_letter on application)
- [ ] Add inline resume editor on the pipeline card (edit tailored text before submitting)
- [ ] Weekly report: jobs scraped, scored above 70, applied, replies

### Phase 6 — Interview prep (inspired by AIApply's Interview Buddy)
- [ ] New route: `POST /api/applications/[id]/interview-prep`
- [ ] Takes job description + role type, generates likely interview questions with guidance
- [ ] New pipeline column for "Interview" status shows prep materials inline

---

## AIApply Competitive Analysis

AIApply (aiapply.co) is the closest commercial equivalent to what we're building.

### What they do
- Resume + cover letter generation per job (same as our tailor flow)
- Auto-apply to job boards
- ATS scan and optimization
- Interview coaching (their strongest feature — "Interview Buddy")
- Job board aggregator

### Pricing
- $23-29/month base subscription (no auto-apply)
- Auto-apply credits sold separately: $10 for 10, $60 for 100
- Real power-user cost: $100+/month

### What users hate
- Job matching is inaccurate — applies to irrelevant roles, wrong seniority, wrong language
- Volume over quality: spams job boards
- Hidden pricing / billing issues
- BBB rating: F. Trustpilot: 64% 5-star but with an integrity warning

### What users like
- Cover letter generation speed
- Interview Buddy coaching feature (consistently praised)
- Clean UX

### What we should steal from AIApply
1. **Interview prep per application** — generate likely questions from the JD. Show on pipeline card at "screen" or "interview" status.
2. **ATS score feedback loop** — show before AND after ATS score (raw profile vs. tailored resume).
3. **Application velocity metric** — dashboard: applications sent this week, response rate, pipeline health.

### Our strategic advantage
- Score-before-apply: only tailor jobs that actually match (above threshold)
- Full description access: Greenhouse/Lever/Ashby APIs return full JDs, tailoring is grounded in real content
- Self-hosted: no subscription cost, no data leaving your machine
- Direct ATS form-fill via Playwright, no third-party proxy
- Anthropic quality (once switched): haiku for fast ops, sonnet for tailoring quality

---

## Environment Variables

```
GROQ_API_KEY=gsk_...         # current AI key — will be replaced with ANTHROPIC_API_KEY in Phase 3
DB_PATH=data/jobs.db         # optional, defaults to data/jobs.db
```

No other secrets. Gmail auth not yet wired.

---

## Key Files to Know

| File | Why it matters |
|---|---|
| `lib/claude.ts` | All AI calls (analyzeKeywordGap, rewriteResume, scoreJob, generateCoverLetter). Rename to `lib/ai.ts` when switching to Anthropic. |
| `lib/resume-pdf.ts` | Playwright PDF renderer. Builds ATS-safe HTML then calls page.pdf(). |
| `lib/scrapers/_http.ts` | fetchJson, matchesTitleFilter (with seniority exclusion), withRetry |
| `lib/scrapers/index.ts` | `scrapeAll` — entry point for all scraping, handles DB writes |
| `lib/application-state.ts` | State machine: TRANSITIONS + TERMINAL_STATUSES. manual_required is now a valid terminal state. |
| `lib/profile-formatter.ts` | Profile → AI prompt text. Touch this if prompts need tuning. |
| `config/scrapers.json` | Add/remove companies here. No code change needed. |
| `worker/apply.ts` | Apply automation: PDF gen → fillGreenhouse/fillLever/fillAshby → screenshot → DB update |
| `app/api/jobs/import/route.ts` | Manual URL import: Playwright headless fetch, title/company extraction, store as source=custom |
| `components/jobs/ManualJobsSection.tsx` | My Jobs UI: URL input, job grid for source=custom jobs |
| `ecosystem.config.js` | PM2 processes — apply worker NOT here, runs manually |
| `scripts/sanity-check.ts` | Run `npx tsx scripts/sanity-check.ts --phase N` to verify system |
| `docs/TEST-PLAN.md` | Full manual test checklist for end-to-end QA |

---

## Session History Summary

### Session 1 — Initial build (from scratch)
- Full Next.js 16 App Router scaffold with Tailwind CSS 4
- SQLite schema and Drizzle ORM setup
- Home page 4-step resume wizard (parse, ATS audit, keyword gap, rewrite)
- ATS audit engine (10 deterministic rules, weighted scoring)
- AI layer via Groq (keyword gap, rewrite, scoring)
- Job board (scrape, filter, sort, score, tailor UI)
- Toast notification system (no library, React context)
- Profile editor (full form, dirty tracking, null-safe for current roles)
- Kanban pipeline with state machine enforcement
- Email inbox (read-only, classification display)
- Scraper layer: Greenhouse, Lever (paginated), Ashby, Workday
- 23 company targets in scrapers.json
- Playwright apply worker (headless Chromium form-filler — broken, Greenhouse selectors only)
- 6-phase sanity check script
- PM2 ecosystem config + Mac Mini setup script
- Bug fixes: ProfileEditor null crash, scrape API runId bug, Groq error path crash, Lever pagination, N+1 email query, duplicate matchesFilter/TRANSITIONS, 7 unguarded JSON.parse calls, missing try/catch in analyze-jd

### Session 2 — GitHub repo initialization
- Initialized standalone git repo inside `projects/resume-omni-tool/` (nested inside BoardRoom monorepo)
- Added `projects/resume-omni-tool/` to BoardRoom's `.gitignore` to suppress status noise
- Created public GitHub repo at github.com/NightmareHel/resume-omni-tool
- Added `CONTEXT.md` as the primary session handoff document

### Session 3 — Phase 1: Apply worker fixes, scraper filtering, My Jobs feature (2026-07-02)

**Phase 1 — Make auto-apply functional:**
- `lib/resume-pdf.ts` (NEW): Playwright page.pdf() resume renderer. ATS-safe HTML template: single-column, Arial 10.5pt, 18pt name, 12pt section headers with border-bottom, flex layout, no tables. Parses `resume_text` (double-newline sections) and reconstructs contact info from profile row. Headless Chromium, Letter format, 0.5in margins.
- `app/api/applications/[id]/resume.pdf/route.ts` (NEW): GET endpoint. Fetches application + profile from DB, calls generateResumePDF, returns PDF as Uint8Array with correct Content-Type headers.
- `next.config.ts` (MODIFIED): Added `playwright` and `playwright-core` to serverExternalPackages.
- `worker/apply.ts` (MODIFIED): Added `os` import + `generateResumePDF` import. Added `ManualRequiredError` class. Added `FillData` interface (name, email, phone, linkedin, resumePath, coverLetter). PDF generation in `processApplication` before dispatch: calls generateResumePDF, writes to os.tmpdir(), sets fillData.resumePath. Added `fillLever()`: iframe-first approach with frameLocator, aria-label/autocomplete/name* selectors, custom question detection by counting visible text inputs vs known standard count. Added `fillAshby()`: _systemfield_* selectors with aria-label fallback, same detection pattern. `fillGreenhouse()` updated to accept FillData (resumePath instead of resumeText), temp file logic removed. Dispatch block is now three explicit if/else branches. Catch block handles ManualRequiredError separately (sets status=manual_required) vs general errors (saves message to notes). finally block always cleans up tmpPath.
- `lib/application-state.ts` (MODIFIED): Added `manual_required: []` to TRANSITIONS. Added `pending → manual_required` transition. Added `manual_required` to TERMINAL_STATUSES. This prevents the apply worker from retrying aborted applications.
- `lib/claude.ts` (MODIFIED): Added `generateCoverLetter(profileText, jobTitle, company, jdText): Promise<string>`. Uses system+user message pattern. System prompt instructs plain text, 3-4 paragraphs, no salutation header. User prompt passes full profile text, role info, and JD. temp=0.4, max_tokens=700. Returns trimmed string.
- `app/api/jobs/[id]/tailor/route.ts` (MODIFIED): Added generateCoverLetter to imports. Added `coverLetter: string` variable. Updated Promise.all to run all three AI calls in parallel: [analyzeKeywordGap, rewriteResume, generateCoverLetter]. Changed `cover_letter: null` to `cover_letter: coverLetter`. Added `coverLetter` to response payload.

**Scraper seniority filtering:**
- `lib/scrapers/_http.ts` (MODIFIED): Added `TITLE_EXCLUDES` constant (13 terms: senior, sr., staff, principal, lead, manager, director, head, vp, vice president, architect, distinguished, intern, co-op). Added `matchesTitleFilter(title, includes?)` function that checks excludes first, then delegates to matchesFilter. Exported alongside existing matchesFilter.
- `lib/scrapers/greenhouse.ts`, `lever.ts`, `ashby.ts`, `workday.ts` (ALL MODIFIED): Changed import from `matchesFilter` to `matchesTitleFilter`. Changed title filter call from `matchesFilter(title, config.titleFilter)` to `matchesTitleFilter(title, config.titleFilter)`. The `config.titleFilter &&` guard was removed (matchesTitleFilter handles undefined includes).
- DB was fully wiped (jobs, applications, email_threads, scrape_runs) and re-scraped. 233 clean jobs now in DB (all passing seniority exclusion). 3 targets returned 404: Ramp (rampfinancial), Snowflake (snowflake), Perplexity (perplexity-ai).

**My Jobs section (manual URL import):**
- `app/api/jobs/import/route.ts` (NEW): POST endpoint. Validates URL format. Checks DB for duplicate (unique on url column) before hitting Playwright. Launches headless Chromium, navigates with networkidle, extracts: page title, og:site_name meta, body.innerText (first 6000 chars). Parses title/company from rawTitle using ATS suffix stripping (Greenhouse, Lever, Ashby, LinkedIn, Indeed, Workday) then pipe-split then dash-split heuristics. og:site_name used as company if available. Stores as source=custom, external_id=url. Returns 409 on duplicate, 400 on fetch error, created job on success.
- `components/jobs/ManualJobsSection.tsx` (NEW): Client component with URL input, "Add Job" button, job grid. Fetches GET /api/jobs?source=custom&limit=100 on mount. handleAdd POSTs to /api/jobs/import, prepends result to state, clears input. handleScore/handleStatusChange/handleTailorInternal follow identical pattern to JobBoard handlers. Shows "Fetching..." during Playwright fetch. 409 → toast "Already added". Reuses JobCard component with full feature parity.
- `app/api/jobs/route.ts` (MODIFIED): Added `ne` to drizzle-orm imports. Added `excludeCustom` query param. When `excludeCustom=true`, adds `ne(jobs.source, 'custom')` to where filters. Prevents source filter and excludeCustom from conflicting (they can coexist — source=greenhouse + excludeCustom=true works fine).
- `components/jobs/JobBoard.tsx` (MODIFIED): Added `params.set('excludeCustom', 'true')` to loadJobs(). Scraped jobs board now never shows custom jobs.
- `app/jobs/page.tsx` (MODIFIED): Added ManualJobsSection import. Wrapped both sections in flex-col gap-10 div. ManualJobsSection renders above a `<hr className="border-zinc-700" />` divider, then JobBoard below.

**Commits this session:**
- `7402f06` — Phase 1: make auto-apply functional (7 files, 405 insertions)
- `7344c7f` — Scrapers: exclude senior/lead/staff/architect/intern titles (5 files)
- `b74b818` — Add My Jobs section: manual URL import with Playwright extraction (5 files)
