# Decision Log — JobPilot

Architectural decisions, rationale, and tradeoffs. Add an entry any time a non-obvious choice is made.

---

## better-sqlite3 over Turso / Prisma / PlanetScale

**Decision:** Use better-sqlite3 with Drizzle ORM for local SQLite.

**Why:**
- Single-user local tool running on a Mac Mini. No need for a hosted database.
- better-sqlite3 is synchronous — no async/await complexity in a tool that's already async everywhere else from network calls.
- Turso (libsql) adds network latency and requires an account/token. Overkill for one user.
- Prisma is heavy and requires a separate prisma generate step. Drizzle is lighter and schema-first.
- Zero ops: the DB is a file on disk, backed up by Time Machine.

**Tradeoff:** SQLite can't scale to concurrent writes from multiple users. Acceptable since this is single-user. If the project ever goes multi-user, the migration path is to swap getDb() for a pg/turso client.

---

## Separate worker process over Next.js API routes for background tasks

**Decision:** Workers run as separate Node.js processes (`worker/scraper.ts`, `worker/apply.ts`, `worker/email-sync.ts`) rather than inside Next.js API routes.

**Why:**
- Next.js API routes have a 60-second timeout on Vercel and no native cron scheduling.
- Scraping 10 companies can take 2–5 minutes. Email sync is network-dependent.
- Playwright can't run inside a serverless function at all.
- Separate processes restart independently if they crash — if the scraper dies, the web UI keeps working.

**Tradeoff:** Two processes to manage instead of one. Mitigated by PM2 in production and `concurrently` in development.

---

## Playwright sidecar over puppeteer or selenium

**Decision:** Use Playwright for form auto-fill.

**Why:**
- Playwright has native TypeScript support and is actively maintained by Microsoft.
- Better auto-wait behavior than Puppeteer — reduces flaky selectors.
- Supports multiple browser engines; Chromium is the default and sufficient.
- p-queue caps concurrency at 2 to avoid memory issues on Mac Mini.

**Tradeoff:** Larger install size (~300MB for Chromium). Acceptable since this is a local tool, not a serverless deployment.

---

## Groq (llama-3.3-70b) over Anthropic Claude for scoring and classification

**Decision:** All LLM calls use Groq via the existing `lib/claude.ts` client.

**Why:**
- Groq API key is already configured and working from Phase 1 of ResumeOmniTool.
- Groq inference is significantly faster and cheaper per token than Anthropic for structured JSON extraction tasks.
- llama-3.3-70b handles JSON extraction reliably with explicit format instructions.
- Avoid adding a second API key and SDK dependency.

**Tradeoff:** Less capability than Claude Sonnet/Opus for nuanced resume rewriting. The existing rewrite feature already uses this model and produces acceptable output. If quality becomes an issue, the `MODEL` constant in `lib/claude.ts` is the single change point.

---

## Rewrite career-ops .mjs to .ts over dynamic import()

**Decision:** Port the career-ops scraper modules to TypeScript files rather than using `import()` to load the .mjs files.

**Why:**
- TypeScript provides type safety throughout the scraper layer — input configs, returned job shapes, DB inserts all get checked at compile time.
- `import()` of .mjs files in a mixed CJS/ESM project creates runtime module resolution issues (same class of bug as the pdf-parse ESM issue we already hit).
- A TypeScript port allows us to change return types to match our `Job` DB schema directly, instead of converting at the boundary.
- Drizzle schema types propagate correctly through the codebase.

**Tradeoff:** Maintenance divergence from upstream career-ops. Mitigated by keeping HTTP logic identical and only changing output format and config interface.

---

## Expand ResumeOmniTool over creating a new project

**Decision:** Add JobPilot features directly into the `projects/resume-omni-tool/` directory.

**Why:**
- Existing code (ATS audit, keyword gap, resume rewrite) is directly reused in the tailoring pipeline without HTTP round-trips.
- One npm install, one dev server, one DB file.
- Avoids duplicating shared libraries (Groq client, PDF parser) across two projects.
- Simpler PM2 config on Mac Mini (one process tree instead of two).

**Tradeoff:** The project grows larger and the original resume tool's simplicity is diluted. Mitigated by keeping the original `/` page untouched and routing new features to distinct `/jobs`, `/pipeline`, `/profile`, `/emails` paths.

---

## Human-in-loop apply over fully autonomous

**Decision:** Playwright submits applications only after Sid approves them from the /pipeline view.

**Why:**
- Automated job applications without review risk submitting with wrong resume version, applying to roles Sid didn't intend to, or triggering ToS violations at speed.
- A rejected application can't be un-submitted. The cost of a mistake is high.
- The tailoring step already does the heavy lifting. Review takes 30 seconds per application.

**Tradeoff:** Less throughput than fully autonomous. Acceptable — quality over volume is the goal.

---

## config/scrapers.json as target list over UI-driven company management

**Decision:** Target companies and filters are configured in a JSON file, not in a database-driven admin UI.

**Why:**
- The list of target companies changes rarely (a few times a week at most).
- A JSON file is version-controlled, diffable, and easy to edit in VSCode.
- Adding a UI for this would require another DB table, API routes, and a CRUD form — significant scope for a feature used infrequently.

**Tradeoff:** Changes require editing a file and restarting the worker. Acceptable for a single-user local tool.

---

## WAL mode for SQLite

**Decision:** Enable WAL journal mode on DB startup.

**Why:**
- Default rollback journal mode locks the entire file on writes. This blocks Next.js API route reads while the scraper worker is inserting jobs.
- WAL allows concurrent reads and one writer without blocking.
- No configuration needed beyond `PRAGMA journal_mode=WAL` once on startup.

**Tradeoff:** WAL creates a `-wal` and `-shm` sidecar file alongside `jobs.db`. These are normal SQLite WAL files and don't require manual management.

---

## Drizzle migrations over manual schema edits

**Decision:** All schema changes after Phase 1 go through `drizzle-kit generate` and are committed to `drizzle/migrations/`.

**Why:**
- Migrations are the audit trail for schema evolution. If something breaks, we know exactly what changed and when.
- Drizzle auto-applies pending migrations on startup — no manual SQL required.
- New columns are always nullable or have defaults in migrations so existing rows aren't broken.

**Tradeoff:** Extra step when adding a column (generate + commit). Worth it for reproducibility.
