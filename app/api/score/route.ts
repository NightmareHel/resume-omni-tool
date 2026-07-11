import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { jobs, profile } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { scoreAndPersist } from '@/lib/score-job';

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

  try {
    const result = await scoreAndPersist(job, prof);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[score] Groq error:', msg);
    return NextResponse.json({ error: `Scoring failed: ${msg}` }, { status: 502 });
  }
}
