/**
 * Phase-gated sanity check script.
 * Usage: npx tsx scripts/sanity-check.ts --phase 1
 */

// Load .env.local for GROQ_API_KEY etc. (Next.js doesn't auto-load outside the server)
import fs from 'fs';
import path from 'path';
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
  }
}

const phase = (() => {
  const idx = process.argv.indexOf('--phase');
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : 0;
})();

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${name}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

// ─────────────────────────────────────────────
//  Phase 1 — Database Foundation
// ─────────────────────────────────────────────
async function phase1() {
  console.log('\nPhase 1: Database Foundation\n');

  // Dynamic imports so this file doesn't break on phases where deps may not exist
  const { getDb } = await import('../lib/db');
  const { jobs, profile, scrape_runs } = await import('../lib/schema');
  const { jobId, uuid } = await import('../lib/ids');
  const { eq } = await import('drizzle-orm');

  const db = getDb();

  // 1. Insert a synthetic job
  const syntheticId = jobId('test', 'sanity-001');
  const now = new Date().toISOString();

  await db.insert(jobs).values({
    id:          syntheticId,
    source:      'test',
    external_id: 'sanity-001',
    title:       'Sanity Check Engineer',
    company:     'Test Corp',
    location:    'Philadelphia, PA',
    url:         'https://example.com/sanity-001',
    scraped_at:  now,
    status:      'new',
  }).onConflictDoNothing();

  const [job] = await db.select().from(jobs).where(eq(jobs.id, syntheticId));
  check('insert + query job', !!job && job.title === 'Sanity Check Engineer');
  check('job id is deterministic SHA-256', syntheticId.length === 32 && /^[0-9a-f]+$/.test(syntheticId));

  // 2. Insert synthetic profile
  await db.insert(profile).values({
    id:         'default',
    full_name:  'Sid Kumar',
    email:      'sidhant31032004@gmail.com',
    updated_at: now,
  }).onConflictDoUpdate({ target: profile.id, set: { updated_at: now } });

  const [prof] = await db.select().from(profile);
  check('insert + query profile', !!prof && prof.full_name === 'Sid Kumar');

  // 3. Insert synthetic scrape_run
  const runId = uuid();
  await db.insert(scrape_runs).values({
    id:         runId,
    started_at: now,
    sources:    JSON.stringify(['test']),
    status:     'completed',
    completed_at: now,
  });

  const [run] = await db.select().from(scrape_runs).where(eq(scrape_runs.id, runId));
  check('insert + query scrape_run', !!run && run.status === 'completed');

  // 4. UNIQUE constraint — duplicate should be ignored
  let dupeError = false;
  try {
    await db.insert(jobs).values({
      id:          jobId('test', 'sanity-001-dupe'),
      source:      'test',
      external_id: 'sanity-001',
      title:       'Duplicate',
      company:     'Test Corp',
      url:         'https://example.com/sanity-001-dupe',
      scraped_at:  now,
      status:      'new',
    });
    // onConflict not used — should throw
  } catch {
    dupeError = true;
  }
  check('UNIQUE constraint fires on (source, external_id) duplicate', dupeError);

  // 5. Cleanup synthetic rows
  await db.delete(jobs).where(eq(jobs.id, syntheticId));
  await db.delete(scrape_runs).where(eq(scrape_runs.id, runId));
}

// ─────────────────────────────────────────────
//  Phase 2 — Scraper Layer
// ─────────────────────────────────────────────
async function phase2() {
  console.log('\nPhase 2: Scraper Layer\n');

  const { scrapeGreenhouse } = await import('../lib/scrapers/greenhouse');
  const { scrapeAll } = await import('../lib/scrapers/index');
  const { getDb } = await import('../lib/db');
  const { jobs, scrape_runs } = await import('../lib/schema');
  const { eq, count } = await import('drizzle-orm');

  const db = getDb();

  // 1. Scrape a known public Greenhouse board (Anthropic)
  console.log('  Testing Greenhouse scraper (Anthropic)...');
  let ghJobs: Awaited<ReturnType<typeof scrapeGreenhouse>> = [];
  try {
    ghJobs = await scrapeGreenhouse({ company: 'Anthropic', slug: 'anthropic' });
    check('Greenhouse returns at least 1 job', ghJobs.length > 0);
    check('Greenhouse job has required fields', !!ghJobs[0]?.title && !!ghJobs[0]?.url && !!ghJobs[0]?.company);
  } catch (err) {
    check('Greenhouse scraper runs without fatal error', false, String(err));
  }

  // 2. scrapeAll with test config (Greenhouse only, no filters)
  console.log('  Testing scrapeAll with test config...');
  const jobsBefore = (await db.select({ c: count() }).from(jobs))[0].c;

  const result = await scrapeAll({
    targets: [{ source: 'greenhouse', company: 'Anthropic', slug: 'anthropic' }],
  });

  const jobsAfter = (await db.select({ c: count() }).from(jobs))[0].c;
  check('scrapeAll returns a runId', typeof result.runId === 'string' && result.runId.length > 0);
  check('scrapeAll inserts jobs into DB', jobsAfter > jobsBefore || result.jobsNew === 0);

  // 3. Re-run same config — no duplicates
  const result2 = await scrapeAll({
    targets: [{ source: 'greenhouse', company: 'Anthropic', slug: 'anthropic' }],
  });
  const jobsAfter2 = (await db.select({ c: count() }).from(jobs))[0].c;
  check('Re-scrape inserts 0 new jobs (dedup)', result2.jobsNew === 0 && jobsAfter2 === jobsAfter);

  // 4. scrape_runs logged with completed status
  const [run] = await db.select().from(scrape_runs).where(eq(scrape_runs.id, result.runId));
  check('scrape_run logged with completed status', run?.status === 'completed');
}

// ─────────────────────────────────────────────
//  Phase 3 — Job Board + Scoring
// ─────────────────────────────────────────────
async function phase3() {
  console.log('\nPhase 3: Job Board + Scoring\n');

  const { getDb } = await import('../lib/db');
  const { jobs } = await import('../lib/schema');
  const { eq } = await import('drizzle-orm');

  const db = getDb();

  // 1. GET /api/jobs returns correct shape
  const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

  const listRes = await fetch(`${baseUrl}/api/jobs?limit=5`);
  check('GET /api/jobs responds 200', listRes.status === 200, `got ${listRes.status}`);

  if (listRes.ok) {
    const data = await listRes.json();
    check('GET /api/jobs has jobs array', Array.isArray(data.jobs));
    check('GET /api/jobs has total field', typeof data.total === 'number');

    // 2. Filter by source
    const [first] = await db.select().from(jobs);
    if (first) {
      const filtered = await fetch(`${baseUrl}/api/jobs?source=${first.source}&limit=5`);
      const fdata = await filtered.json();
      check('GET /api/jobs?source= filters correctly', fdata.jobs.every((j: { source: string }) => j.source === first.source));

      // 3. PATCH status
      const patch = await fetch(`${baseUrl}/api/jobs/${first.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'reviewed' }),
      });
      check('PATCH /api/jobs/:id returns 200', patch.status === 200);
      const pdata = await patch.json();
      check('PATCH /api/jobs/:id updates status', pdata.job?.status === 'reviewed');

      // Restore
      await db.update(jobs).set({ status: 'new' }).where(eq(jobs.id, first.id));
    } else {
      check('Jobs exist in DB for testing', false, 'Run phase 2 first');
    }

    // 4. Invalid status returns 400
    const [any] = await db.select().from(jobs);
    if (any) {
      const bad = await fetch(`${baseUrl}/api/jobs/${any.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'invalid-status' }),
      });
      check('PATCH with invalid status returns 400', bad.status === 400);
    }
  }

  // 5. Score endpoint (requires profile from phase 4)
  const profCheck = await fetch(`${baseUrl}/api/profile`);
  const { profile: prof } = await profCheck.json();
  if (prof?.full_name) {
    const [jobToScore] = await db.select().from(jobs);
    if (jobToScore) {
      console.log(`\n  Testing /api/score against "${jobToScore.title}"...`);
      const scoreRes = await fetch(`${baseUrl}/api/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: jobToScore.id }),
      });
      check('POST /api/score returns 200', scoreRes.status === 200, `got ${scoreRes.status}`);
      if (scoreRes.ok) {
        const { score, grade, summary } = await scoreRes.json();
        check('Score is 0-100', typeof score === 'number' && score >= 0 && score <= 100, `got ${score}`);
        check('Grade is A-F', ['A', 'B', 'C', 'D', 'F'].includes(grade), `got ${grade}`);
        check('Summary is non-empty string', typeof summary === 'string' && summary.length > 5);
      }
    } else {
      console.log('\n  No jobs in DB — skip scoring (run phase 2 first)');
    }
  } else {
    console.log('\n  No profile saved — skip scoring (run phase 4 first)');
  }
}

// ─────────────────────────────────────────────
//  Phase 5 — Applications + Pipeline
// ─────────────────────────────────────────────
async function phase5() {
  console.log('\nPhase 5: Applications + Pipeline\n');

  const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
  const { getDb } = await import('../lib/db');
  const { jobs, applications } = await import('../lib/schema');
  const { jobId } = await import('../lib/ids');
  const { eq } = await import('drizzle-orm');
  const db = getDb();

  // 1. GET /api/applications shape
  const listRes = await fetch(`${baseUrl}/api/applications`);
  check('GET /api/applications returns 200', listRes.status === 200);
  const { applications: apps } = await listRes.json();
  check('GET /api/applications returns array', Array.isArray(apps));

  // 2. Seed a synthetic job + application for state machine tests
  const syntheticJobId = jobId('test', 'pipeline-sanity-001');
  const now = new Date().toISOString();
  await db.insert(jobs).values({
    id: syntheticJobId, source: 'test', external_id: 'pipeline-sanity-001',
    title: 'Pipeline Test Role', company: 'Test Corp',
    url: 'https://example.com/pipeline-sanity-001', scraped_at: now, status: 'new',
  }).onConflictDoNothing();

  // Remove any stale test application for this job
  await db.delete(applications).where(eq(applications.job_id, syntheticJobId));

  const createRes = await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: syntheticJobId, resume_text: 'Test resume content', status: 'draft' }),
  });
  check('POST /api/applications creates draft', createRes.status === 201 || createRes.status === 200, `got ${createRes.status}`);
  if (!createRes.ok) {
    console.log('  Cannot create test application — skipping state machine tests');
    await db.delete(jobs).where(eq(jobs.id, syntheticJobId));
    return;
  }
  const { application: newApp } = await createRes.json();

  // 3. Full happy-path state machine: draft → pending → submitted → replied → screen → interview → offer
  const transitions = [
    { from: 'draft', to: 'pending' },
    { from: 'pending', to: 'submitted' },
    { from: 'submitted', to: 'replied' },
    { from: 'replied', to: 'screen' },
    { from: 'screen', to: 'interview' },
    { from: 'interview', to: 'offer' },
  ];

  let currentStatus = 'draft';
  for (const { from, to } of transitions) {
    const res = await fetch(`${baseUrl}/api/applications/${newApp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: to }),
    });
    check(`Transition ${from} → ${to}`, res.status === 200, `got ${res.status}`);
    if (res.ok) currentStatus = to;
  }

  // 4. Terminal: offer → anything fails
  const fromOffer = await fetch(`${baseUrl}/api/applications/${newApp.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'pending' }),
  });
  check('Terminal (offer) → pending returns 400', fromOffer.status === 400, `got ${fromOffer.status}`);

  // 5. Invalid skip transition: draft → offer (skips intermediate states)
  // Seed a fresh draft for this
  await db.delete(applications).where(eq(applications.job_id, syntheticJobId));
  const fresh = await fetch(`${baseUrl}/api/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: syntheticJobId, resume_text: 'Test resume', status: 'draft' }),
  });
  if (fresh.ok) {
    const { application: freshApp } = await fresh.json();
    const skipRes = await fetch(`${baseUrl}/api/applications/${freshApp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'offer' }),
    });
    check('Invalid skip draft → offer returns 400', skipRes.status === 400, `got ${skipRes.status}`);
  }

  // 6. Notes persist
  const [anyApp] = await db.select().from(applications).where(eq(applications.job_id, syntheticJobId));
  if (anyApp) {
    const notesRes = await fetch(`${baseUrl}/api/applications/${anyApp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: anyApp.status, notes: 'Pipeline sanity note' }),
    });
    if (notesRes.ok) {
      const nd = await notesRes.json();
      check('Notes saved correctly', nd.application?.notes === 'Pipeline sanity note');
    }
  }

  // Cleanup
  await db.delete(applications).where(eq(applications.job_id, syntheticJobId));
  await db.delete(jobs).where(eq(jobs.id, syntheticJobId));

  console.log('\n  Playwright form-fill: manual test — run worker/apply.ts and approve a pending application from /pipeline');
}

// ─────────────────────────────────────────────
//  Phase 6 — Email Reply Tracking
// ─────────────────────────────────────────────
async function phase6() {
  console.log('\nPhase 6: Email Reply Tracking\n');

  const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
  const { getDb } = await import('../lib/db');
  const { email_threads, applications } = await import('../lib/schema');
  const db = getDb();

  // 1. Seed a synthetic email thread
  const { uuid } = await import('../lib/ids');
  const threadId = `sanity-thread-${Date.now()}`;
  const now = new Date().toISOString();

  const [anyApp] = await db.select().from(applications);

  await db.insert(email_threads).values({
    id:              threadId,
    application_id:  anyApp?.id ?? null,
    job_id:          anyApp?.job_id ?? null,
    subject:         'Interview invitation — Software Engineer',
    from_email:      'recruiter@example.com',
    from_name:       'Jane Recruiter',
    received_at:     now,
    snippet:         "Hi Sid, we'd love to schedule a technical interview...",
    classification:  'interview',
    action_required: 1,
    read:            0,
  });

  // 2. GET /api/emails
  const listRes = await fetch(`${baseUrl}/api/emails`);
  check('GET /api/emails returns 200', listRes.status === 200);
  const { threads } = await listRes.json();
  check('GET /api/emails returns array', Array.isArray(threads));
  check('Seeded thread appears in response', threads.some((t: { id: string }) => t.id === threadId));

  // 3. POST /api/emails/sync
  const syncRes = await fetch(`${baseUrl}/api/emails/sync`, { method: 'POST' });
  check('POST /api/emails/sync returns 200', syncRes.status === 200);
  const syncData = await syncRes.json();
  check('Sync response has found field', typeof syncData.found === 'number');

  // 4. Classification test (local, no MCP)
  const { classifyThread } = await import('../worker/email-sync');
  const result = await classifyThread(
    'Interview invitation — Software Engineer',
    "Hi Sid, we'd love to schedule a technical interview for the Software Engineer role."
  );
  check('Classification: interview subject → interview', result.classification === 'interview');
  check('Classification: interview → action_required true', result.action_required === true);

  const rejResult = await classifyThread(
    'Update on your application',
    "After careful consideration, we will not be moving forward with your application at this time."
  );
  check('Classification: rejection text → rejection', rejResult.classification === 'rejection');

  // Cleanup
  const { eq } = await import('drizzle-orm');
  await db.delete(email_threads).where(eq(email_threads.id, threadId));
}

// ─────────────────────────────────────────────
//  Phase 4 — Profile + Tailoring
// ─────────────────────────────────────────────
async function phase4() {
  console.log('\nPhase 4: Profile + Tailoring\n');

  const baseUrl = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
  const { getDb } = await import('../lib/db');
  const { jobs, applications } = await import('../lib/schema');
  const { eq } = await import('drizzle-orm');
  const db = getDb();

  // 1. Save profile
  const testProfile = {
    full_name:        'Sid Kumar',
    email:            'sidhant31032004@gmail.com',
    phone:            '+1 215-555-0100',
    location:         'Philadelphia, PA',
    linkedin_url:     'https://linkedin.com/in/sidkumar',
    github_url:       'https://github.com/nightmarehel',
    summary:          'AI engineer with experience building LLM agents, RAG pipelines, and automation tools. CS grad (Temple University). Starting SAP AI internship August 2026.',
    skills:           ['Python', 'TypeScript', 'Next.js', 'LLM', 'RAG', 'Node.js', 'React', 'SQLite', 'Playwright'],
    experience:       [
      { company: 'SAP', title: 'AI Development Intern', start: '2026-08', end: null, bullets: ['Building AI agents and automation on the Digital Platforms team', 'Working with RAG, Joule, and Adobe AEP'] },
      { company: 'Freelance', title: 'AI Freelance Developer', start: '2025-01', end: '2026-07', bullets: ['Built multiagent automation systems for clients', 'Shipped AGI Simulation and TeleGAssistant as portfolio projects'] },
    ],
    education:        [{ school: 'Temple University', degree: 'BS Computer Science', end: '2026-08' }],
    target_roles:     ['AI Engineer', 'Software Engineer', 'ML Engineer'],
    target_locations: ['Philadelphia', 'Remote', 'New York'],
    salary_min:       85000,
  };

  const putRes = await fetch(`${baseUrl}/api/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testProfile),
  });
  check('PUT /api/profile returns 200', putRes.status === 200, `got ${putRes.status}`);

  // 2. Read it back
  const getRes = await fetch(`${baseUrl}/api/profile`);
  check('GET /api/profile returns 200', getRes.status === 200);
  const { profile } = await getRes.json();
  check('Profile full_name matches', profile?.full_name === 'Sid Kumar');
  check('Profile skills is array', Array.isArray(profile?.skills));

  // 3. Tailor a real scraped job
  const [job] = await db.select().from(jobs);
  if (!job) {
    check('Job exists for tailoring test', false, 'Run phase 2 first');
    return;
  }

  // Remove any existing draft for this job first
  await db.delete(applications).where(eq(applications.job_id, job.id));

  console.log(`  Tailoring: "${job.title}" at ${job.company}...`);
  const tailorRes = await fetch(`${baseUrl}/api/jobs/${job.id}/tailor`, { method: 'POST' });
  check('POST /api/jobs/:id/tailor returns 200', tailorRes.status === 200, `got ${tailorRes.status}`);

  if (tailorRes.ok) {
    const { application, rewrite } = await tailorRes.json();
    check('Application created with draft status', application?.status === 'draft');
    check('resume_text is non-empty', typeof application?.resume_text === 'string' && application.resume_text.length > 50);
    check('Rewrite has sections', Array.isArray(rewrite?.sections) && rewrite.sections.length > 0);
    check('resume_text differs from raw profile summary', !application.resume_text.includes('Source of truth'));

    // Confirm row in DB
    const [dbApp] = await db.select().from(applications).where(eq(applications.id, application.id));
    check('Application row persisted in DB', !!dbApp);

    // 409 on second tailor attempt
    const dupRes = await fetch(`${baseUrl}/api/jobs/${job.id}/tailor`, { method: 'POST' });
    check('Second tailor returns 409', dupRes.status === 409);
  }
}

// ─────────────────────────────────────────────
//  Dispatch
// ─────────────────────────────────────────────
async function main() {
  console.log(`Running sanity check for Phase ${phase}`);

  if (phase === 1) await phase1();
  else if (phase === 2) await phase2();
  else if (phase === 3) await phase3();
  else if (phase === 4) await phase4();
  else if (phase === 5) await phase5();
  else if (phase === 6) await phase6();
  else {
    console.error(`No sanity check implemented for phase ${phase}`);
    process.exit(1);
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
