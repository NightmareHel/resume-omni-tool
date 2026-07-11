// Shared scoring pipeline: LLM fit score + sponsorship/seniority composition,
// persisted to the jobs row. Single source of truth used by the /api/score
// route, worker/score.ts, and scripts/score-backlog.ts.

import { eq, sql, isNull, and, isNotNull } from 'drizzle-orm';
import { getDb } from './db';
import { jobs, profile } from './schema';
import { scoreJob, type ScoreResult } from './claude';
import { profileToScoreText } from './profile-formatter';

type JobRow = typeof jobs.$inferSelect;
type ProfileRow = typeof profile.$inferSelect;

export interface ScoredJob extends ScoreResult {
  score: number; // composed score (post sponsorship/seniority penalties)
  sponsor_status: string | null;
}

// Next unscored jobs in application-priority order: confirmed entry-level
// first, sponsor-friendly before unknown, newest posting first. Jobs without
// a description are excluded (nothing to score against).
export async function nextUnscoredJobs(limit: number): Promise<JobRow[]> {
  const db = getDb();
  return db
    .select()
    .from(jobs)
    .where(and(isNull(jobs.fit_score), isNotNull(jobs.description)))
    .orderBy(
      sql`CASE WHEN ${jobs.entry_level} = 1 THEN 0 ELSE 1 END`,
      sql`CASE
        WHEN ${jobs.sponsor_status} = 'confirmed' THEN 0
        WHEN ${jobs.sponsor_status} = 'likely' THEN 1
        WHEN ${jobs.sponsor_status} = 'possible' THEN 2
        WHEN ${jobs.sponsor_status} IS NULL THEN 3
        WHEN ${jobs.sponsor_status} = 'unknown' THEN 4
        ELSE 5 END`,
      sql`${jobs.posted_at} DESC NULLS LAST`
    )
    .limit(limit);
}

// Groq free-tier 429s carry no typed status on the OpenAI SDK error reliably;
// detect by message. Returns suggested wait ms or null if not a rate limit.
export function rateLimitWaitMs(err: unknown): number | null {
  const e = err as { status?: number; message?: string };
  const msg = e?.message ?? '';
  if (e?.status === 429 || /rate limit|429/i.test(msg)) {
    const m = /try again in ([\d.]+)s/i.exec(msg);
    return m ? Math.ceil(parseFloat(m[1]) * 1000) + 500 : 60_000;
  }
  return null;
}

export async function scoreAndPersist(job: JobRow, prof: ProfileRow): Promise<ScoredJob> {
  const profileText = profileToScoreText(prof);
  const description = job.description ?? `${job.title} at ${job.company}`;

  const result = await scoreJob(profileText, description);

  // LLM cross-check: may downgrade a regex/history verdict, never upgrade a
  // blocked one (a "US citizens only" hit stays blocked no matter what).
  let sponsorStatus = job.sponsor_status;
  if (sponsorStatus !== 'blocked') {
    if (result.sponsorship === 'no') sponsorStatus = 'unlikely';
    else if (result.sponsorship === 'yes') sponsorStatus = 'confirmed';
  }
  let entryLevel = job.entry_level;
  if (entryLevel === null && result.seniority) {
    entryLevel = result.seniority === 'entry' ? 1 : 0;
  }

  // Score composition: sponsorship and seniority penalties on top of raw fit
  let score = result.score;
  if (sponsorStatus === 'blocked') score = Math.min(score, 20);
  else if (sponsorStatus === 'unlikely') score = Math.round(score * 0.8);
  else if (sponsorStatus === 'unknown') score = Math.max(0, score - 5);
  if ((job.years_required ?? 0) >= 3 || result.seniority === 'senior') score = Math.round(score * 0.7);

  const db = getDb();
  await db.update(jobs).set({
    fit_score:      score,
    fit_grade:      result.grade,
    fit_summary:    result.summary,
    sponsor_status: sponsorStatus,
    entry_level:    entryLevel,
  }).where(eq(jobs.id, job.id));

  return { ...result, score, sponsor_status: sponsorStatus };
}
