import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { jobs, profile, applications } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { analyzeKeywordGap, rewriteResume, generateCoverLetter } from '@/lib/claude';
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

  // SSE stream: stage events as each AI call completes, live cover letter
  // tokens, then a final `done` event carrying the same payload the old
  // JSON response had. Pre-check failures above still return plain JSON.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Swallow enqueue failures so a client disconnect mid-stream doesn't
      // abort the AI calls or the DB insert — the draft still gets saved.
      const send = (obj: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {}
      };

      try {
        const [keywordGap, rewrite, coverLetter] = await Promise.all([
          analyzeKeywordGap(resumeText, jdText).then((r) => {
            send({ type: 'stage', stage: 'gap', status: 'done' });
            return r;
          }),
          rewriteResume(resumeText, jdText).then((r) => {
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

        const tailoredResume = rewrite.sections.map((s) => `${s.name.toUpperCase()}\n${s.rewritten}`).join('\n\n');
        const now = new Date().toISOString();

        await db.insert(applications).values({
          id:           uuid(),
          job_id:       id,
          status:       'draft',
          resume_text:  tailoredResume,
          cover_letter: coverLetter,
          keyword_gap:  JSON.stringify(keywordGap),
          created_at:   now,
          updated_at:   now,
        });

        const [application] = await db.select().from(applications).where(eq(applications.job_id, id));

        send({ type: 'done', application, keywordGap, rewrite, coverLetter });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[tailor] AI error:', msg);
        send({ type: 'error', error: `AI rewrite failed: ${msg}` });
      } finally {
        try {
          controller.close();
        } catch {}
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
