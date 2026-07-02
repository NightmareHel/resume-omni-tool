# JobPilot — Session Context & Roadmap

*Last updated: 2026-07-02*

This file exists so any future session can pick up exactly where we left off without re-reading the entire codebase. It covers what was built, what works, what is broken, the full gap list, and the roadmap to production.

---

## What This Project Is

**JobPilot** (also called ResumeOmniTool in some places — name inconsistency is a known issue) is a self-hosted AI job application pipeline built for Sid's personal job search. It is NOT a SaaS product — it is a private tool running on a Mac Mini, connecting to Sid's Gmail, and targeting specific companies in the tri-state area and remote roles.

The core flow is:

```
Scrape jobs from 23 companies → Score each against profile → Tailor resume per job → Auto-submit via Playwright → Track replies in email inbox → Move through kanban pipeline
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
| Workers | node-cron (scraper: 6h, email-sync: 30min, apply: 2min poll) |
| Process | PM2 (web + scraper + email-sync; apply worker NOT in PM2) |
| Auth | None — local only |

**Important:** `lib/claude.ts` uses Groq/Llama, NOT Claude/Anthropic. The `@anthropic-ai/sdk` package is installed but never imported. All AI calls hit `https://api.groq.com/openai/v1` using the OpenAI SDK. The plan is to eventually switch to Anthropic — see roadmap.

---

## Directory Overview

```
resume-omni-tool/
├── app/                    # Next.js pages + API routes
│   ├── page.tsx            # Home: 4-step resume analysis wizard (upload → ATS → gap → rewrite)
│   ├── jobs/page.tsx       # Job board (scrape, score, filter, sort)
│   ├── pipeline/page.tsx   # Kanban application tracker
│   ├── emails/page.tsx     # Email inbox (read-only, classification badges)
│   ├── profile/page.tsx    # Master profile editor
│   └── api/                # All API routes (see below)
├── components/             # React components
├── lib/                    # Core logic: db, AI client, scrapers, formatters, ATS rules
├── worker/                 # Long-running background processes
├── scripts/                # sanity-check.ts test suite, setup-mac-mini.sh
├── config/scrapers.json    # 23 scraper targets
├── data/jobs.db            # SQLite database
├── drizzle/migrations/     # Single migration: all 5 tables
└── docs/                   # API-CONTRACT, ARCHITECTURE, DATA-MODEL, DECISIONS, TEST-PLAN
```

---

## Database Schema

5 tables, single migration (`0000_cheerful_triathlon.sql`):

**`jobs`** — scraped postings
- `id`: SHA-256 of `source+external_id` (dedup key)
- `source`: greenhouse | lever | ashby | workday
- `external_id`, `title`, `company`, `location`, `remote` (0/1), `url`, `description`, `salary_min`, `salary_max`, `posted_at`, `scraped_at`
- `fit_score` (0-100), `fit_grade` (A-F), `fit_summary` (one-sentence AI note)
- `status`: new | reviewed | queued | applied | archived
- Unique on `(source, external_id)` and on `url`

**`applications`** — one per job the user tailored/applied to
- `id`: UUID
- `job_id`: FK to jobs (CASCADE delete)
- `status`: draft | pending | submitted | replied | screen | interview | offer | rejected | withdrawn
- `resume_text`: tailored resume (plain text)
- `cover_letter`: always null (not yet generated)
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
| GET | `/api/jobs` | List jobs (filter: source, status, minScore, search; sort: scraped_at, score_desc, score_asc; paginated) |
| GET | `/api/jobs/[id]` | Single job |
| PATCH | `/api/jobs/[id]` | Update job status |
| POST | `/api/jobs/[id]/tailor` | AI tailor resume + create draft application |
| GET | `/api/applications` | List applications |
| POST | `/api/applications` | Create manual draft |
| GET | `/api/applications/[id]` | Single application + job |
| PATCH | `/api/applications/[id]` | Update status (enforces state machine) or notes |
| POST | `/api/applications/[id]/submit` | Mark as queued (stub — apply worker does the actual work) |
| GET | `/api/emails` | List email threads |
| POST | `/api/emails/sync` | Trigger sync (stub in standalone mode) |

---

## AI Functions (lib/claude.ts)

All three use Groq llama-3.3-70b-versatile. JSON extracted via regex from model output.

- `analyzeKeywordGap(resumeText, jdText)` → `{ mustHave: string[], niceToHave: string[], placementSuggestions: ... }`
- `rewriteResume(resumeText, jdText)` → `{ sections: [{ name, original, rewritten, changes }] }`
- `scoreJob(profileText, jobDescription)` → `{ score: 0-100, grade: A-F, summary: string }`

---

## Scraper Targets (config/scrapers.json)

23 companies. All filter to eng/AI titles, tri-state + remote locations.

| Company | ATS |
|---|---|
| Anthropic, OpenAI, Databricks, W&B, Palantir, MongoDB, Snowflake, Stripe, Figma, Ramp, Brex, Cockroach Labs, Notion, Duolingo, Benchling, Anduril | Greenhouse |
| Cohere, Scale AI, Hugging Face | Lever |
| Perplexity, Linear, Vercel, Replit | Ashby |

Location filter: new york, new jersey, philadelphia, boston (remote auto-passes).
Title filter: engineer, developer, software, ai, ml, scientist, backend, fullstack.

**Note:** Some Lever slugs (scaleai, huggingface) are unverified. Run a scrape and check the logs.

---

## Workers

**`worker/scraper.ts`** — runs every 6 hours via node-cron. Calls `scrapeAll` against all 23 targets in parallel. Included in PM2.

**`worker/email-sync.ts`** — runs every 30 minutes. STUB in standalone mode. The actual Gmail pull requires the Boardroom Claude Code session with Gmail MCP tools active. Contains `classifyThread` and `matchToApplication` functions that are fully functional (tested in sanity-check phase 6) but the data ingestion path does not work without MCP.

**`worker/apply.ts`** — polls every 2 minutes for `pending` applications. Uses Playwright Chromium. NOT in PM2 — must be started manually. Known issues below.

---

## What Works

- Full resume wizard on home page (parse → ATS audit → keyword gap → AI rewrite)
- Profile editor with experience/education/skills, dirty tracking, save confirmation
- Job scraping from Greenhouse, Lever, Ashby targets
- Fit scoring per job (score written back to DB)
- Job board with filtering, sorting by score, search, sticky filters (localStorage)
- Batch "Score All" button (sequential with 500ms gaps)
- Resume tailoring per job (AI generates tailored resume text, creates draft application)
- Tailor loading state, scrape polling with completion toast, global toast system
- Pipeline kanban (9 columns, status transitions enforced by state machine, notes, resume preview)
- All error paths are guarded (API routes return proper JSON errors, client uses defensive `.catch()`)
- TypeScript clean (`npx tsc --noEmit` passes)
- Sanity check script phases 1-6 (offline DB, Greenhouse live scrape, API endpoints, AI tailor, state machine, email classification)
- PM2 ecosystem config for web + scraper + email-sync

---

## What Is Broken or Incomplete

### Critical (blocks real use)

**1. Resume upload in apply worker is .txt**
`worker/apply.ts` writes `resume_text` as a `.txt` temp file before uploading to the ATS file input. Most ATS systems reject `.txt` — they require `.pdf` or `.docx`. Actual submissions will fail at the file upload step. Fix: PDF generation using Playwright's `page.pdf()` (Playwright is already installed). Build `lib/resume-pdf.ts` + `GET /api/applications/[id]/resume.pdf`, then have the apply worker call that to get the buffer before uploading.

**2. Lever/Ashby apply uses Greenhouse selectors**
`fillGreenhouse()` in `worker/apply.ts` is called for greenhouse, lever, AND ashby jobs. It targets `#first_name`, `#email`, `input[type="file"]` — these are Greenhouse-specific CSS IDs. Lever and Ashby have completely different DOM structures. Real Lever/Ashby submissions will fail or fill wrong fields.

**3. Email sync is a stub**
`POST /api/emails/sync` and `worker/email-sync.ts` do not actually pull Gmail in standalone mode. The Gmail integration is architecturally coupled to the Boardroom MCP session (Claude Code with Gmail MCP). To make this standalone, it needs a separate Gmail OAuth flow (Google API + refresh token stored in `.env.local`). This is a meaningful amount of work.

**4. Cover letter generation missing**
The tailor route sets `cover_letter: null` on every application. The apply worker passes `app.cover_letter` to the form fill — it will always be empty. Need to add a `generateCoverLetter(profileText, jdText, companyName)` function in `lib/claude.ts` and wire it into the tailor route alongside `rewriteResume`.

**5. /api/applications/[id]/submit is a no-op**
It validates status but does not update the DB or trigger anything. The apply worker picks up `pending` items on its own 2-minute poll. The "Approve & Queue" button in the UI works correctly (it calls PATCH to move status to `pending` first), but the subsequent submit call does nothing useful.

### Non-Critical (UX / data gaps)

**6. Keyword gap not persisted**
`POST /api/jobs/[id]/tailor` returns the keyword gap analysis but never stores it. It's lost on page reload. Should be stored in the `applications` table or a new `tailor_analysis` JSON column.

**7. No resume edit endpoint**
After a draft application is created, there is no API to update `resume_text` or `cover_letter`. Only status and notes can be changed via PATCH.

**8. Apply worker not in PM2**
`ecosystem.config.js` has `web`, `scraper`, `email-sync` — but not `apply`. Starting the apply worker requires a separate manual command. Fix: add it to `ecosystem.config.js`.

**9. Score thresholds inconsistent**
`ScoreMeter.tsx` (used on home page and keyword gap) colors green at 80, amber at 60. `JobCard.tsx` score badge colors green at 75, amber at 55. Pick one and unify.

**10. PDF ATS detection partial**
Table, multi-column, and header/footer ATS checks are detected from DOCX via mammoth warning messages. For PDF uploads, these checks always pass regardless of actual content. `lib/parse-pdf.ts` has no structural analysis.

**11. Naming inconsistency**
Navbar says "JobPilot". `app/layout.tsx` metadata says "ResumeOmniTool". `lib/claude.ts` uses Groq not Claude. Should settle on "JobPilot" as the product name.

**12. No Workday targets**
`lib/scrapers/workday.ts` exists and works (CXS pagination) but there are no Workday entries in `config/scrapers.json`. Also, Workday scraper returns `description: null` because the detail page requires Playwright — not worth the complexity now.

**13. Ashby HTML in description**
Ashby API sometimes returns HTML in the `descriptionPlain` field. No stripping applied. Raw HTML shows in job description view.

---

## Mac Mini Deployment Plan

The project has a `scripts/setup-mac-mini.sh` that handles the one-shot setup. The gap is the apply worker not being in PM2.

**Steps to go live:**
1. SSH into Mac Mini
2. Clone repo
3. Set `GROQ_API_KEY` in `.env.local`
4. Run `bash scripts/setup-mac-mini.sh` — installs, migrates, builds, starts PM2
5. Manually add apply worker to PM2: `pm2 start "npx tsx worker/apply.ts" --name apply`
6. `pm2 save`
7. `pm2 startup` to survive reboots
8. Access via local IP or set up Tailscale for remote access from laptop

PM2 will keep web + scraper + email-sync running. Scraper runs every 6 hours autonomously.

**What you need before going live:**
- Fix the resume PDF generation (critical — apply worker is broken without it)
- Decide on the email sync approach (MCP session vs. standalone OAuth)
- Verify all 23 scraper slugs actually return jobs (run a scrape, check logs for 404s)

---

## Roadmap: Fun Project to Production Tool

### Phase 1 — Make apply actually work (current blocker)
- [ ] `lib/resume-pdf.ts`: use Playwright `page.pdf()` to render resume text as styled PDF
- [ ] `GET /api/applications/[id]/resume.pdf`: streams PDF bytes
- [ ] Update `worker/apply.ts` to fetch and upload PDF instead of `.txt`
- [ ] Write separate `fillLever()` and `fillAshby()` functions with correct selectors (or use `aria-label` and `placeholder` selectors instead of fragile IDs)
- [ ] Add cover letter generation to `lib/claude.ts` and wire into tailor route
- [ ] Add apply worker to `ecosystem.config.js`

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
- [ ] Add token usage logging so you know what you're spending

### Phase 4 — Expand job sources
- [ ] Verify all 23 Lever/Ashby slugs return real results
- [ ] Add Indeed or LinkedIn scraping (both harder — rate limiting, login walls)
- [ ] Consider adding more NYC/remote AI companies (Cohere's NY office, Hugging Face NYC)
- [ ] Add "remote only" filter option to the job board UI

### Phase 5 — Pipeline intelligence
- [ ] Persist keyword gap result in DB (new JSON column on applications)
- [ ] Add resume edit endpoint (PATCH resume_text and cover_letter on application)
- [ ] Add inline resume editor on the pipeline card (edit tailored text before submitting)
- [ ] Weekly report: how many jobs scraped, how many scored above 70, how many applied, how many replies

### Phase 6 — Interview prep (inspired by AIApply's Interview Buddy)
- [ ] New route: `POST /api/applications/[id]/interview-prep`
- [ ] Takes job description + role type, generates likely interview questions with guidance
- [ ] New pipeline column for "Interview" status shows prep materials inline
- [ ] Mock interview mode (question/answer loop with AI feedback)

---

## AIApply Competitive Analysis

AIApply (aiapply.co) is the closest commercial equivalent to what we're building. Here's the breakdown:

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
- Pricing hidden behind account creation — no public page

### Technical approach
- Likely browser automation (extension or headless browser) — not publicly disclosed
- Basic keyword matching for job-to-profile fit (users report poor accuracy)
- No verified API integrations with ATS platforms disclosed
- Applies broadly by volume, not selectively by quality

### What users hate
- Job matching is inaccurate — applies to irrelevant roles, wrong seniority, wrong language
- Volume over quality: spams job boards rather than targeting good fits
- Hidden pricing / billing issues
- Slow performance and support
- BBB rating: F. Trustpilot: 64% 5-star but with a Trustpilot integrity warning

### What users like
- Cover letter generation speed
- Interview Buddy coaching feature (consistently praised)
- Clean UX
- Can save time on manual application work when it works

### Competitor comparison
| Tool | Monthly Cost | Auto-apply | Quality approach |
|---|---|---|---|
| AIApply | $29 + $10/10 credits | Yes | Volume, poor matching |
| FastApply | $13-44 | Yes | Per-job CV tailoring, 20+ boards |
| JobCopilot | ~$56 | Yes (50/day Elite) | Verified company careers only, higher quality |
| LoopCV | Free tier + paid | Yes | Broad, A/B testing CVs |
| **JobPilot (ours)** | $0 (self-hosted) | Yes (Playwright) | Strategic: score → select → tailor → apply |

### What we should steal from AIApply
1. **Interview prep per application** — generate likely questions from the JD and role type. Show on the pipeline card when status hits "screen" or "interview". This is their best feature.
2. **ATS score feedback loop** — show before AND after ATS score (raw profile vs. tailored resume). Demonstrates value of the tailoring step.
3. **Application velocity metric** — dashboard showing applications sent this week, response rate, current pipeline health. Makes the tool feel alive.

### What we should NOT do
- Volume apply (spam) — our strategy is targeted: score first, only tailor jobs above threshold
- Hidden pricing — not relevant since this is private
- Separate credit system for different features — no artificial gates

### Our strategic advantage over AIApply
- Score-before-apply: we only tailor jobs that actually match (above threshold), AIApply applies broadly
- Full description access: Greenhouse/Lever/Ashby APIs return full JDs, so our tailoring is grounded in real content
- Self-hosted: no subscription cost, no data leaving your machine, full control
- Direct ATS form-fill via Playwright: no dependency on a third-party proxy
- Anthropic quality (once switched): haiku for fast ops, sonnet for quality tailoring — both better than llama-3.3-70b for nuanced writing

---

## Environment Variables

```
GROQ_API_KEY=gsk_...         # current AI key — will be replaced with ANTHROPIC_API_KEY
DB_PATH=data/jobs.db         # optional, defaults to data/jobs.db
```

No other secrets. Gmail auth not yet wired.

---

## Key Files to Know

| File | Why it matters |
|---|---|
| `lib/claude.ts` | All AI calls. Rename to `lib/ai.ts` when switching to Anthropic. |
| `lib/scrapers/index.ts` | `scrapeAll` — entry point for all scraping, handles DB writes |
| `lib/application-state.ts` | State machine transitions — single source of truth |
| `lib/profile-formatter.ts` | Profile → AI prompt text. Touch this if prompts need tuning. |
| `config/scrapers.json` | Add/remove companies here. No code change needed. |
| `worker/apply.ts` | The apply automation — most broken part of the system |
| `ecosystem.config.js` | PM2 processes — add apply worker here |
| `scripts/sanity-check.ts` | Run `npx tsx scripts/sanity-check.ts --phase N` to verify system |
| `docs/TEST-PLAN.md` | Full manual test checklist for end-to-end QA |

---

## Session History Summary

### What was built (from scratch, over multiple sessions)
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
- Playwright apply worker (headless Chromium form-filler)
- 6-phase sanity check script
- PM2 ecosystem config
- Mac Mini setup script
- Shared utilities: matchesFilter (4 scrapers use it), TRANSITIONS (routes + components), profile-formatter (tailor + score routes)

### Bug fixes made
- ProfileEditor null crash (experience.end = null for current roles)
- Scrape API returning literal 'pending' instead of real runId
- Tailor crash ("Failed to execute json on Response") — unguarded Groq error path
- Lever silent truncation at ~250 jobs (now paginated)
- N+1 query in email matchToApplication (now batch inArray)
- Duplicate matchesFilter functions across 4 scrapers (consolidated)
- Duplicate TRANSITIONS in 2 places (consolidated)
- 7 unguarded JSON.parse calls in profile formatters (safeParseArray wrapper)
- Missing try/catch in analyze-jd route

### What was NOT built (explicitly out of scope so far)
- PDF generation (Playwright page.pdf() approach — next thing to build)
- Cover letter generation
- Gmail OAuth standalone integration
- Anthropic API integration (Groq is placeholder)
- Interview prep feature
- Application edit UI (post-tailoring resume editing)
- Dashboard / analytics view
