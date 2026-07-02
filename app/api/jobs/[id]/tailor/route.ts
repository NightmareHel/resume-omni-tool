import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { jobs, profile, applications } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { analyzeKeywordGap, rewriteResume } from '@/lib/claude';
import { uuid } from '@/lib/ids';
import { profileToResumeText } from '@/lib/profile-formatter';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const [prof] = await db.select().from(profile).where(eq(profile.id, 'default'));
  if (!prof || !prof.full_name) {
    return NextResponse.json({ error: 'Profile is empty — fill in your profile first at /profile' }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.job_id, id), eq(applications.status, 'draft')));

  if (existing) {
    return NextResponse.json({ error: 'A draft application already exists for this job' }, { status: 409 });
  }

  const resumeText = profileToResumeText(prof);
  const jdText = job.description ?? `${job.title} at ${job.company}`;

  let keywordGap: Awaited<ReturnType<typeof analyzeKeywordGap>>;
  let rewrite: Awaited<ReturnType<typeof rewriteResume>>;

  try {
    [keywordGap, rewrite] = await Promise.all([
      analyzeKeywordGap(resumeText, jdText),
      rewriteResume(resumeText, jdText),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[tailor] Groq error:', msg);
    return NextResponse.json(
      { error: `AI rewrite failed: ${msg}` },
      { status: 502 }
    );
  }

  const tailoredResume = rewrite.sections.map((s) => `${s.name.toUpperCase()}\n${s.rewritten}`).join('\n\n');
  const now = new Date().toISOString();

  await db.insert(applications).values({
    id:           uuid(),
    job_id:       id,
    status:       'draft',
    resume_text:  tailoredResume,
    cover_letter: null,
    created_at:   now,
    updated_at:   now,
  });

  const [application] = await db.select().from(applications).where(eq(applications.job_id, id));

  return NextResponse.json({ application, keywordGap, rewrite });
}
