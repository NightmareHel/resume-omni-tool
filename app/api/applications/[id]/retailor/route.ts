import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { jobs, profile, applications } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { analyzeKeywordGap, tailorResume, generateCoverLetter } from '@/lib/claude';
import { profileToResumeText } from '@/lib/profile-formatter';
import { fitResumeText } from '@/lib/resume-pdf';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [app] = await db.select().from(applications).where(eq(applications.id, id));
  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  if (app.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft applications can be re-tailored' }, { status: 400 });
  }

  const [job] = await db.select().from(jobs).where(eq(jobs.id, app.job_id));
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const [prof] = await db.select().from(profile).where(eq(profile.id, 'default'));
  if (!prof || !prof.full_name) {
    return NextResponse.json({ error: 'Profile is empty' }, { status: 400 });
  }

  const resumeText = profileToResumeText(prof);
  const jdText = job.description ?? `${job.title} at ${job.company}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {}
      };

      try {
        const [keywordGap, tailoring, coverLetter] = await Promise.all([
          analyzeKeywordGap(resumeText, jdText).then((r) => {
            send({ type: 'stage', stage: 'gap', status: 'done' });
            return r;
          }),
          tailorResume(prof, jdText).then((r) => {
            send({ type: 'stage', stage: 'rewrite', status: 'done' });
            return r;
          }),
          generateCoverLetter(resumeText, job.title, job.company, jdText, (text) =>
            send({ type: 'cover_delta', text })
          ).then((r) => {
            send({ type: 'stage', stage: 'cover', status: 'done' });
            return r;
          }),
        ]);

        const tailoredResume = await fitResumeText(prof, tailoring);
        const now = new Date().toISOString();

        await db.update(applications).set({
          resume_text:  tailoredResume,
          cover_letter: coverLetter,
          keyword_gap:  JSON.stringify(keywordGap),
          updated_at:   now,
        }).where(eq(applications.id, id));

        const [updated] = await db.select().from(applications).where(eq(applications.id, id));
        send({ type: 'done', application: updated, keywordGap, tailoring, coverLetter });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[retailor] AI error:', msg);
        send({ type: 'error', error: `AI rewrite failed: ${msg}` });
      } finally {
        try { controller.close(); } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
