import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { jobs, profile } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { scoreJob } from '@/lib/claude';
import { profileToScoreText } from '@/lib/profile-formatter';

export async function POST(req: NextRequest) {
  const db = getDb();
  const { jobId } = await req.json();

  if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 });

  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const [prof] = await db.select().from(profile).where(eq(profile.id, 'default'));
  if (!prof || !prof.full_name) {
    return NextResponse.json({ error: 'Profile is empty — fill in your profile first' }, { status: 400 });
  }

  const profileText = profileToScoreText(prof);
  const description = job.description ?? `${job.title} at ${job.company}`;

  let result: Awaited<ReturnType<typeof scoreJob>>;
  try {
    result = await scoreJob(profileText, description);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[score] Groq error:', msg);
    return NextResponse.json({ error: `Scoring failed: ${msg}` }, { status: 502 });
  }

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

  await db.update(jobs).set({
    fit_score:      score,
    fit_grade:      result.grade,
    fit_summary:    result.summary,
    sponsor_status: sponsorStatus,
    entry_level:    entryLevel,
  }).where(eq(jobs.id, jobId));

  return NextResponse.json({ ...result, score, sponsor_status: sponsorStatus });
}
