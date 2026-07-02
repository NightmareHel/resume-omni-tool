import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { jobs } from '@/lib/schema';
import { eq } from 'drizzle-orm';

const VALID_STATUSES = ['new', 'reviewed', 'queued', 'applied', 'archived'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ job });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [existing] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 });
  }

  const updates: Partial<typeof existing> = {};
  if (body.status) updates.status = body.status;

  await db.update(jobs).set(updates).where(eq(jobs.id, id));
  const [updated] = await db.select().from(jobs).where(eq(jobs.id, id));
  return NextResponse.json({ job: updated });
}
