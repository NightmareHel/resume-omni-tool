import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { applications, jobs, profile } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { generateInterviewPrep } from '@/lib/claude';
import { profileToScoreText } from '@/lib/profile-formatter';

// Generates interview prep from the JD + profile and caches it on the
// application row. Subsequent calls return the stored result unless
// ?force=true regenerates.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const force = req.nextUrl.searchParams.get('force') === 'true';

  const [app] = await db.select().from(applications).where(eq(applications.id, id));
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (app.interview_prep && !force) {
    try { return NextResponse.json({ prep: JSON.parse(app.interview_prep), cached: true }); }
    catch { /* corrupted blob — fall through and regenerate */ }
  }

  const [job] = await db.select().from(jobs).where(eq(jobs.id, app.job_id));
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (!job.description) {
    return NextResponse.json({ error: 'This job has no description to prep against' }, { status: 400 });
  }

  const [prof] = await db.select().from(profile).where(eq(profile.id, 'default'));
  if (!prof || !prof.full_name) {
    return NextResponse.json({ error: 'Profile is empty' }, { status: 400 });
  }

  try {
    const prep = await generateInterviewPrep(profileToScoreText(prof), job.title, job.company, job.description);
    await db.update(applications).set({
      interview_prep: JSON.stringify(prep),
      updated_at: new Date().toISOString(),
    }).where(eq(applications.id, id));
    return NextResponse.json({ prep, cached: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[interview-prep] AI error:', msg);
    return NextResponse.json({ error: `Prep generation failed: ${msg}` }, { status: 502 });
  }
}
