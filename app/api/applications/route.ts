import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { applications, jobs } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { uuid } from '@/lib/ids';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');

  const where = status ? eq(applications.status, status) : undefined;
  // Join the job onto each application so the pipeline board can resolve
  // title/company/url without a separate bulk /api/jobs fetch (which only
  // returns a slice of the 4k+ jobs and drops freshly tailored ones).
  const rows = await db
    .select({
      application: applications,
      job: {
        id:                jobs.id,
        title:             jobs.title,
        company:           jobs.company,
        source:            jobs.source,
        url:               jobs.url,
        fit_score:         jobs.fit_score,
        fit_grade:         jobs.fit_grade,
        sponsor_status:    jobs.sponsor_status,
        sponsor_evidence:  jobs.sponsor_evidence,
        sponsor_lca_count: jobs.sponsor_lca_count,
      },
    })
    .from(applications)
    .leftJoin(jobs, eq(applications.job_id, jobs.id))
    .where(where)
    .orderBy(applications.created_at);

  return NextResponse.json({
    applications: rows.map((r) => r.application),
    jobs: rows.map((r) => r.job).filter((j): j is NonNullable<typeof j> => j !== null && j.id !== null),
  });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const { jobId, resumeText, coverLetter } = await req.json();

  if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 });

  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const [existing] = await db.select().from(applications).where(
    and(eq(applications.job_id, jobId), eq(applications.status, 'draft'))
  );
  if (existing) return NextResponse.json({ error: 'Draft application already exists for this job' }, { status: 409 });

  const now = new Date().toISOString();
  const id = uuid();

  await db.insert(applications).values({
    id,
    job_id:      jobId,
    status:      'draft',
    resume_text: resumeText ?? null,
    cover_letter: coverLetter ?? null,
    created_at:  now,
    updated_at:  now,
  });

  const [app] = await db.select().from(applications).where(eq(applications.id, id));
  return NextResponse.json({ application: app });
}
