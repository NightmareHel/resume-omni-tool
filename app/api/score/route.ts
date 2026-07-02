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

  await db.update(jobs).set({
    fit_score:   result.score,
    fit_grade:   result.grade,
    fit_summary: result.summary,
  }).where(eq(jobs.id, jobId));

  return NextResponse.json(result);
}
