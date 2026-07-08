# API Contract — JobPilot

All routes under `/api/`. JSON in, JSON out. Errors always return `{ error: string }`.

---

## Existing Routes (Frozen — Do Not Modify)

### POST /api/parse-resume
Input: `FormData` with field `file` (PDF|DOCX) or `text` (plain string)
Output:
```json
{
  "text": "extracted resume text",
  "atsResult": {
    "score": 82,
    "checks": [
      { "id": "no-tables", "name": "No Tables", "status": "pass", "message": "...", "impact": "high" }
    ]
  }
}
```

### POST /api/analyze-jd
Input: `{ "resumeText": string, "jdText": string }`
Output:
```json
{
  "mustHave": ["Python", "LLM"],
  "niceToHave": ["Docker"],
  "found": ["Python"],
  "missing": ["LLM", "Docker"],
  "suggested": [{ "keyword": "LLM", "placement": "Add to Skills section" }],
  "score": 60
}
```

### POST /api/rewrite
Input: `{ "resumeText": string, "jdText": string }`
Output:
```json
{
  "sections": [
    { "name": "Professional Summary", "original": "...", "rewritten": "...", "changes": ["..."] }
  ],
  "summary": "Changed summary to mirror JD terminology."
}
```

---

## Jobs

### GET /api/jobs
Query params (all optional):
- `source` — `greenhouse | lever | ashby | workday | custom | simplify | workable | themuse | smartrecruiters`
- `status` — `new | reviewed | queued | applied | archived`
- `minScore` — number 0–100
- `search` — full-text search on title + company
- `hideBlocked` — `true` omits jobs with sponsor_status `blocked` or `unlikely`
- `entryOnly` — `true` shows only jobs with `entry_level = 1`
- `sponsorStatus` — exact match on `sponsor_status` value
- `excludeCustom` — `true` omits source=custom (used by JobBoard to exclude My Jobs)
- `page` — default 1
- `limit` — default 50, max 200

Output:
```json
{
  "jobs": [ /* Job[] */ ],
  "total": 142,
  "page": 1,
  "limit": 50
}
```

### GET /api/jobs/[id]
Output: `{ "job": Job }`
Errors: `404` if not found

### PATCH /api/jobs/[id]
Input: `{ "status": "reviewed" }` (only `status` is patchable via this route)
Output: `{ "job": Job }`
Errors: `400` if status value is invalid, `404` if not found

### POST /api/scrape
Input (optional): `{ "sources": ["greenhouse", "lever"] }`
If sources omitted, all configured providers are scraped.
Output: `{ "runId": "uuid" }` — fire-and-forget; poll scrape_runs table for status
Errors: `409` if a scrape is already running

### POST /api/score
Input: `{ "jobId": string }`
Output:
```json
{ "score": 78, "grade": "B", "summary": "Strong Python/LLM fit. Missing RAG and AWS experience." }
```
Errors: `404` if job not found, `400` if profile is empty (can't score without profile)

---

## Applications

### GET /api/applications
Query params (optional): `status` — any ApplicationStatus value
Output: `{ "applications": Application[] }`

### POST /api/applications
Input:
```json
{ "jobId": "sha256hash", "resumeText": "...", "coverLetter": "..." }
```
Output: `{ "application": Application }`
Errors: `404` if jobId not found, `409` if application already exists for this job

### GET /api/applications/[id]
Output: `{ "application": Application, "job": Job }`
Errors: `404`

### PATCH /api/applications/[id]
Input (all fields optional):
```json
{ "status": "pending", "notes": "Looks good", "resume_text": "...", "cover_letter": "..." }
```
- `status` transitions enforced by state machine (see DATA-MODEL.md)
- `resume_text` and `cover_letter` can be updated on any status — no state machine enforcement
Output: `{ "application": Application }`
Errors: `400` if transition is invalid, `404`

### DELETE /api/applications/[id]
Deletes the application row. Only permitted when status is `draft` or a terminal status (`rejected`, `withdrawn`, `manual_required`). Blocked on active statuses to prevent data loss.
Output: `{ "ok": true }`
Errors: `400` if status is not draft/terminal, `404`

### GET /api/applications/[id]/resume.pdf
Generates and streams a PDF of the tailored resume via Playwright headless Chromium.
Returns: `application/pdf` inline
Errors: `400` if no resume_text on application, `400` if profile missing, `404`
Note: cold start is ~2-4s (Chromium launch). Subsequent calls on a warm server are faster.

### GET /api/applications/[id]/cover.pdf
Generates and streams a PDF of the cover letter via Playwright headless Chromium.
Returns: `application/pdf` inline
Errors: `400` if no cover_letter on application, `400` if profile missing, `404`

### POST /api/applications/[id]/retailor
Re-runs the full tailor flow (keyword gap + resume rewrite + cover letter) for an existing application. Replaces `resume_text`, `cover_letter`, and `keyword_gap` in-place. Only allowed on `draft` status.
Returns: SSE stream (same event structure as `POST /api/jobs/[id]/tailor`)
Events: `stage` / `cover_delta` / `done` / `error`
Errors: `400` if not draft, `404`

### POST /api/applications/[id]/critique
Runs AI critique of the tailored resume against the job description.
Input: none
Output:
```json
{
  "ats_score": 78,
  "issues": [
    { "severity": "high", "issue": "Missing core keyword 'RAG'", "fix": "Add to Skills and mention in last role bullet" },
    { "severity": "medium", "issue": "Summary is generic", "fix": "Mirror JD language about 'production ML systems'" }
  ],
  "verdict": "Solid match, one high-severity keyword gap to fix."
}
```
Errors: `400` if no resume_text, `404`

### POST /api/applications/[id]/submit
Queues the application for Playwright form submission. Returns immediately.
Input: none
Output: `{ "queued": true, "applicationId": string }`
Errors: `400` if status is not `pending`, `404`

---

## Profile

### GET /api/profile
Output: `{ "profile": Profile | null }`
Returns null if profile has never been saved.

### PUT /api/profile
Input: Profile fields (all optional in the request; any provided field is updated):
```json
{
  "full_name": "Sid Kumar",
  "email": "sidhant31032004@gmail.com",
  "phone": "+1 ...",
  "location": "Philadelphia, PA",
  "linkedin_url": "...",
  "github_url": "...",
  "portfolio_url": "...",
  "summary": "...",
  "experience": [ { "company": "SAP", "title": "AI Intern", "start": "2026-08", "end": null, "bullets": ["..."] } ],
  "education": [ { "school": "Temple University", "degree": "BS CS", "end": "2026-08" } ],
  "skills": ["Python", "LLM", "Next.js"],
  "target_roles": ["AI Engineer", "Software Engineer"],
  "target_locations": ["Philadelphia", "Remote"],
  "salary_min": 90000
}
```
Output: `{ "profile": Profile }`

---

## Tailor (under Jobs)

### POST /api/jobs/[id]/tailor
Reads profile + job description from DB. Calls analyzeKeywordGap() + rewriteResume(). Creates a draft application.
Input: none
Output:
```json
{
  "application": Application,
  "keywordGap": KeywordGapResult,
  "rewrite": RewriteResult
}
```
Errors: `404` if job not found, `400` if profile is empty, `409` if draft application already exists for this job

---

## Dashboard

### GET /api/dashboard
Returns all stats needed for the command center home page in a single call.
Output:
```json
{
  "totalJobs": 4043,
  "sponsorBreakdown": { "confirmed": 84, "likely": 1280, "possible": 1019, "unknown": 1448, "unlikely": 10, "blocked": 145 },
  "funnel": { "draft": 3, "pending": 1, "submitted": 2, "replied": 0, "screen": 0, "interview": 0, "offer": 0, "rejected": 1, "withdrawn": 0 },
  "drafts": 3,
  "interviews": 0,
  "applicationsThisWeek": 3,
  "actionQueue": {
    "manualRequired": [ /* Application[] limit 5 */ ],
    "staleDrafts": [ /* Application[] older than 2 days, limit 5 */ ],
    "topUnscored": [ /* Job[] with fit_score null and sponsor_status not blocked, limit 5 */ ]
  }
}
```

---

## Emails

### GET /api/emails
Output: `{ "threads": EmailThread[] }`

### POST /api/emails/sync
Triggers Gmail MCP poll synchronously (or kicks off async — TBD based on MCP response time).
Output: `{ "found": 12, "matched": 4 }`

---

## Type Definitions

```typescript
type JobStatus = 'new' | 'reviewed' | 'queued' | 'applied' | 'archived';
type JobSource = 'greenhouse' | 'lever' | 'ashby' | 'workday' | 'custom' | 'simplify' | 'workable' | 'themuse' | 'smartrecruiters';
type SponsorStatus = 'confirmed' | 'likely' | 'possible' | 'unknown' | 'unlikely' | 'blocked';

interface Job {
  id: string;
  source: JobSource;
  external_id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  url: string;
  description: string;
  salary_min: number | null;
  salary_max: number | null;
  posted_at: string | null;       // ISO 8601
  scraped_at: string;             // ISO 8601
  fit_score: number | null;
  fit_grade: string | null;       // A | B | C | D | F
  fit_summary: string | null;
  status: JobStatus;
  // Sponsorship + seniority (set at scrape time by lib/classify-job.ts)
  sponsor_status: SponsorStatus | null;
  sponsor_evidence: string | null; // verbatim JD phrase that triggered the verdict
  sponsor_lca_count: number | null;
  years_required: number | null;
  entry_level: number | null;     // 1 = entry, 0 = not, null = undetermined
  everify: number | null;
}

type ApplicationStatus =
  | 'draft' | 'pending' | 'submitted' | 'replied'
  | 'screen' | 'interview' | 'offer' | 'rejected' | 'withdrawn' | 'manual_required';

interface Application {
  id: string;
  job_id: string;
  status: ApplicationStatus;
  applied_at: string | null;
  submission_method: 'form_fill' | 'email' | 'manual' | null;
  resume_text: string | null;
  cover_letter: string | null;
  keyword_gap: string | null;    // JSON-encoded KeywordGapResult, set by tailor/retailor
  form_data: Record<string, string> | null;
  screenshot_path: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: 'default';
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  summary: string | null;
  experience: ExperienceEntry[] | null;
  education: EducationEntry[] | null;
  skills: string[] | null;
  target_roles: string[] | null;
  target_locations: string[] | null;
  salary_min: number | null;
  updated_at: string;
}

interface ExperienceEntry {
  company: string;
  title: string;
  start: string;      // YYYY-MM
  end: string | null; // YYYY-MM or null (current)
  bullets: string[];
}

interface EducationEntry {
  school: string;
  degree: string;
  end: string; // YYYY-MM
}

type EmailClassification = 'reply' | 'rejection' | 'interview' | 'offer' | 'other';

interface EmailThread {
  id: string;
  application_id: string | null;
  job_id: string | null;
  subject: string;
  from_email: string;
  from_name: string;
  received_at: string;
  snippet: string;
  classification: EmailClassification;
  action_required: boolean;
  read: boolean;
}
```

## Error Format

All errors:
```json
{ "error": "Human-readable description of what went wrong" }
```

HTTP codes used:
- `200` — success
- `400` — bad input (invalid field, invalid status transition)
- `404` — resource not found
- `409` — conflict (duplicate, already running)
- `500` — unexpected server error
