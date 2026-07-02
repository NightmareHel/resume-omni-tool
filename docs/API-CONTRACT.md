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
- `source` — `greenhouse | lever | ashby | workday | custom`
- `status` — `new | reviewed | queued | applied | archived`
- `minScore` — number 0–100
- `search` — full-text search on title + company
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
Input: `{ "status": "pending", "notes": "Looks good" }` (both optional)
Status transitions enforced — see state machine in DATA-MODEL.md.
Output: `{ "application": Application }`
Errors: `400` if transition is invalid (e.g. rejected → offer), `404`

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
type JobSource = 'greenhouse' | 'lever' | 'ashby' | 'workday' | 'custom';

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
  posted_at: string | null;  // ISO 8601
  scraped_at: string;        // ISO 8601
  fit_score: number | null;
  fit_grade: string | null;  // A | B | C | D | F
  fit_summary: string | null;
  status: JobStatus;
}

type ApplicationStatus =
  | 'draft' | 'pending' | 'submitted' | 'replied'
  | 'screen' | 'interview' | 'offer' | 'rejected' | 'withdrawn';

interface Application {
  id: string;
  job_id: string;
  status: ApplicationStatus;
  applied_at: string | null;
  submission_method: 'form_fill' | 'email' | 'manual' | null;
  resume_text: string | null;
  cover_letter: string | null;
  form_data: Record<string, string> | null;  // parsed from JSON column
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
