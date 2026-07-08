# JobPilot — Test Plan

Complete manual test checklist covering every feature and possible application path.

---

## How to Use This Document

Run automated sanity checks first, then work through manual sections in order. Mark each item as you go.
Automated: `npx tsx scripts/sanity-check.ts --phase N`
Manual: Work through sections below with the dev server running at `http://localhost:3000`.

---

## Automated Sanity Checks

Run before any manual testing. All must pass green.

| Phase | Command | What It Tests |
|---|---|---|
| 1 | `--phase 1` | DB insert, UNIQUE constraint, profile CRUD |
| 2 | `--phase 2` | Greenhouse scraper, scrapeAll, dedup |
| 3 | `--phase 3` | Jobs API filters, PATCH status, /api/score |
| 4 | `--phase 4` | Profile save/read, tailoring, 409 on duplicate |
| 5 | `--phase 5` | Full state machine, terminal states, notes |
| 6 | `--phase 6` | Email classification, threads API |

---

## A — Setup

- [ ] Dev server running: `npm run dev`
- [ ] No console errors on homepage (DevTools console clean)
- [ ] All 6 nav links work: Dashboard (/), Jobs (/jobs), Pipeline (/pipeline), Resume (/resume), Profile (/profile), Emails (/emails)
- [ ] Toast system is visible: open any page, confirm no stale alerts in console

---

## B — Profile

**Fill profile:**
- [ ] Go to /profile
- [ ] Enter full name, email, phone, location — save — toast "Profile saved" appears
- [ ] Add experience entry with end date — no console error
- [ ] Add experience entry with no end date (current role) — no console error, no React null warning
- [ ] Add education entry
- [ ] Add 5+ skills via TagInput — try adding a duplicate skill — duplicate blocked
- [ ] Add 3 target roles
- [ ] Set salary minimum (numeric)
- [ ] Save — reload page — all fields repopulate exactly as entered

**Dirty state:**
- [ ] Edit any field without saving — "Unsaved changes" indicator appears
- [ ] Save — indicator disappears

---

## C — Job Scraping

- [ ] Go to /jobs — empty state shows helpful message
- [ ] Click "Scrape Now" — button shows "Scraping..."
- [ ] Wait for completion toast: "Scrape complete — N new jobs found"
- [ ] Job cards appear with title, company, location, source badge (GH/LV/AS/WD)
- [ ] Remote badge shown for remote=true jobs

**Filter persistence:**
- [ ] Filter by source "Greenhouse" — only GH jobs shown
- [ ] Refresh page — Greenhouse filter is still active (localStorage persistence)
- [ ] Search "engineer" — filtered results
- [ ] Clear search — all jobs show again
- [ ] Set min score slider to 50 — only scored jobs with score >= 50 shown

**Sort:**
- [ ] Sort "Score: High to Low" — highest-scored jobs at top
- [ ] Sort "Score: Low to High" — lowest first
- [ ] Sort "Newest First" — returns to default

**Second scrape:**
- [ ] Click "Scrape Now" again — toast shows "0 new jobs found" (dedup working)

---

## D — Job Scoring

**Single score:**
- [ ] Click "Score" on any job — button shows "Scoring..."
- [ ] After ~5-10s: score badge updates (0-100 + letter grade)
- [ ] Reasoning text appears below job title
- [ ] Score persists on page refresh

**Batch score:**
- [ ] Click "Score All" — toast "Scoring N jobs..."
- [ ] Cards update one by one as scores come in
- [ ] Toast "Scoring complete" on finish
- [ ] Jobs already scored are skipped

**Error case:**
- [ ] Clear profile (delete all content) and save empty profile
- [ ] Try to score a job — error toast appears: profile-related error
- [ ] Restore profile data

---

## E — Tailoring

- [ ] Find a job with score 60+ — click "Tailor"
- [ ] Button shows "Tailoring..." and is disabled
- [ ] After ~10-15s: auto-navigate to /pipeline?tailored=true
- [ ] Toast "New draft ready for review" on pipeline page
- [ ] Draft card visible with correct company + role name

**View resume:**
- [ ] Click to expand draft card
- [ ] Resume text visible and non-empty
- [ ] Resume content differs from plain profile summary (tailored for the job)

**Second tailor attempt on same job:**
- [ ] Return to /jobs and click Tailor on the same job again
- [ ] Error toast: "Draft already exists" (or similar 409 message)

---

## F — Pipeline

**Card actions:**
- [ ] Draft card shows "Approve & Queue" button
- [ ] Click "Approve & Queue" — card moves to Pending column, toast "Queued for submission"
- [ ] Add notes to a card — save — reload — notes persist

**State machine (manual transitions):**
- [ ] Pending → Submitted: works
- [ ] Submitted → Replied: works
- [ ] Replied → Screen: works
- [ ] Screen → Interview: works
- [ ] Interview → Offer: works

**Invalid transitions:**
- [ ] Try to move Offer card backward (e.g., to Pending) — error toast, card stays
- [ ] Try to move Rejected card — blocked, error shown

**Withdrawn:**
- [ ] Move any card to Withdrawn — card moves to Withdrawn column
- [ ] Try to move Withdrawn card forward — blocked

---

## G — Playwright Auto-Apply (Manual Worker Test)

Prerequisites: a job with a real Greenhouse URL must be in the DB.

- [ ] Open second terminal: `npx playwright install chromium` (if not yet installed)
- [ ] Create a fresh draft from /jobs → Tailor on a Greenhouse job
- [ ] Approve from /pipeline — status becomes Pending
- [ ] Run worker: `npx tsx worker/apply.ts`
- [ ] Chromium opens (non-headless) — confirm you can see the form
- [ ] First name, last name, email auto-filled
- [ ] Phone auto-filled (if field exists on form)
- [ ] Resume file attached
- [ ] Screenshot captured to `data/screenshots/`
- [ ] Application card moves to Submitted in /pipeline

**Workday job (if available):**
- [ ] Approve a Workday-sourced application
- [ ] Worker skips it — card notes updated: "Workday: manual submission required"
- [ ] Status stays Pending (not auto-submitted)

---

## H — Email Tracking

Setup: requires Gmail MCP connected (run from Boardroom Claude Code session).

- [ ] Send test email to sidhant31032004@gmail.com: Subject "Interview invitation — AI Engineer role", body "Hi Sid, we'd love to schedule a technical interview."
- [ ] Go to /emails
- [ ] Click "Sync Now" — spinner, then toast "Found N emails, matched M to applications"
- [ ] Email appears classified as "interview" with "Action needed" badge
- [ ] Email linked to a matching application (if company name matches submitted app)
- [ ] Send rejection email: "After careful consideration, we will not be moving forward"
- [ ] Sync — classified as "rejection", no action needed badge

---

## I — Edge Cases

| Scenario | Expected |
|---|---|
| Scrape with no internet | Error toast, scrape_runs shows "failed" |
| Score job with no profile | Error toast, profile required |
| Tailor with empty profile | Error toast, 400 from API |
| Navigate to /pipeline with 0 applications | Empty state with link to /jobs |
| Navigate to /emails with 0 threads | Empty state |
| Add same skill twice in TagInput | Second add blocked, no duplicate |
| Two concurrent scrapes | Second returns 409, first continues |
| API down (kill dev server then reload) | Error message shown, loading doesn't freeze |
| Reload page mid-tailor | Tailor continues server-side, result in DB on completion |

---

## H2 — Dashboard

- [ ] Go to / — stat row loads (5 cards: Total Jobs, Likely Sponsors, Drafts, This Week, Interviews)
- [ ] Numbers match: Total Jobs = DB row count, Likely Sponsors = confirmed + likely counts
- [ ] Funnel bars are proportional — tallest bar fills full width, others scale relative to it
- [ ] Sponsorship chip row shows all 6 tiers with correct counts
- [ ] Action queue: Manual Required, Stale Drafts, Top Unscored each show correct items (or "None" state)
- [ ] Skeleton loaders appear briefly on first load before data arrives
- [ ] Clicking stat cards navigates to /jobs or /pipeline as appropriate

---

## I2 — Application Review Workspace

Prerequisites: at least one tailored draft application in DB.

**Detail page load:**
- [ ] Navigate to /pipeline — click "Open" on any card — arrives at /pipeline/[id]
- [ ] Header shows: job title, company name, sponsor badge, fit score, status chip
- [ ] Left column shows PDF iframe
- [ ] Right column shows 4 tabs: Resume, Cover Letter, Quality, Activity

**PDF rendering (critical — see HANDOFF-2026-07-07.md for known issues):**
- [ ] Resume tab is default — resume PDF renders in iframe within 5s
- [ ] No blank white iframe / no browser PDF error page
- [ ] Click "Cover Letter" toggle — cover letter PDF renders
- [ ] Click "Resume" toggle — switches back
- [ ] Click "Download" — PDF downloads to disk and is valid (opens in PDF reader)
- [ ] Directly visit /api/applications/[id]/resume.pdf in a new tab — PDF renders
- [ ] Directly visit /api/applications/[id]/cover.pdf in a new tab — PDF renders

**PDF content (visual check):**
- [ ] Resume: name header at top, contact line, section headers bold with border-bottom
- [ ] Resume: bullet points render as bullets, not dashes or raw characters
- [ ] Resume: no content cut off at page edge (margins adequate)
- [ ] Resume: ATS-safe — single column, no tables, no text boxes
- [ ] Cover letter: name + contact at top, 3-4 paragraphs, wider margins than resume
- [ ] Cover letter: no markdown symbols (`**`, `#`, `-`) visible in output

**Resume editor tab:**
- [ ] Resume text is populated in textarea
- [ ] Edit a word — click "Save + Refresh PDF" — iframe reloads with updated content
- [ ] Verify the edit appears in the new PDF render
- [ ] "Re-Tailor" button visible (draft only) — click — SSE progress "1/3 → 2/3 → 3/3" — toast "Re-tailored successfully"
- [ ] After re-tailor: textarea and iframe both update

**Cover letter editor tab:**
- [ ] Cover letter text populated
- [ ] Edit — save — iframe refreshes

**Quality tab:**
- [ ] Keyword gap panel shows missing keywords (red chips) and found keywords (green chips)
- [ ] Score displayed (e.g. "72/100")
- [ ] "Run Critique" button — click — spinner — issues render with severity labels
- [ ] Issue list: high = red, medium = amber, low = zinc
- [ ] Verdict text appears above issue list
- [ ] "Re-run" button appears after first critique

**Activity tab:**
- [ ] Status controls shown — for draft: "Approve and Queue" button
- [ ] Click "Approve and Queue" — status chip in header updates to "pending"
- [ ] Timeline shows created_at date
- [ ] Notes textarea — type text — click "Save Notes" — reload page — notes persist

**Delete:**
- [ ] On a draft or terminal application: "Delete" button visible in header
- [ ] Click — confirm dialog — redirects to /pipeline — card gone
- [ ] On a pending/submitted application: Delete button NOT shown

---

## I3 — Jobs Page: Sponsor Badges + Filters

- [ ] JobCards show sponsor badge for non-null sponsor_status
- [ ] Confirmed/likely: emerald badge with LCA count if available
- [ ] Blocked: red "No Sponsorship" badge
- [ ] Hover over badge — tooltip shows verbatim evidence phrase (if available)
- [ ] Entry chip appears on entry_level=1 jobs
- [ ] Years chip (e.g. "3yr+") appears where years_required > 0
- [ ] "Hide blocked" toggle: check it — blocked/unlikely jobs disappear — uncheck — return
- [ ] "Entry only" toggle: check — only entry_level=1 jobs shown
- [ ] Sponsor dropdown: select "Confirmed" — only confirmed-sponsor jobs shown

---

## J — What Stays Manual (Not Worth Automating)

| Scenario | Reason |
|---|---|
| Playwright form-fill | Requires real browser + real job posting + human review |
| Gmail email sync | Requires live Gmail MCP session |
| Mac Mini PM2 deploy | One-time ops, verified by `pm2 status` |
| Score quality judgment | LLM output — human evaluates if summary makes sense |
| Visual layout review | Needs human eye for spacing/overflow issues |

---

## K — After Every Deploy / Major Change

Run this quick smoke test (5 minutes):

1. `npx tsc --noEmit` — zero errors
2. `npx tsx scripts/sanity-check.ts --phase 1` through `--phase 6` — all pass
3. Open /profile — no console errors loading existing profile
4. Open /jobs — cards load, Score one job
5. Open /pipeline — existing applications visible
6. Open /emails — threads load or empty state shown
