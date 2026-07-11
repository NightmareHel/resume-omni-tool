import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { applications, jobs } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { TRANSITIONS, TERMINAL_STATUSES } from '@/lib/application-state';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [app] = await db.select().from(applications).where(eq(applications.id, id));
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [job] = await db.select().from(jobs).where(eq(jobs.id, app.job_id));
  return NextResponse.json({ application: app, job: job ?? null });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [app] = await db.select().from(applications).where(eq(applications.id, id));
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();

  if (body.status) {
    const allowed = TRANSITIONS[app.status] ?? [];
    if (!allowed.includes(body.status)) {
      return NextResponse.json({
        error: `Invalid transition: ${app.status} -> ${body.status}. Allowed: ${allowed.join(', ') || 'none (terminal)'}`,
      }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  const updates: Record<string, string | null> = { updated_at: now };
  if (body.status)        updates.status = body.status;
  if ('notes' in body)    updates.notes = body.notes;
  if ('resume_text' in body)  updates.resume_text = body.resume_text;
  if ('cover_letter' in body) updates.cover_letter = body.cover_letter;

  // Manual submission: stamp applied_at + method the first time an
  // application reaches submitted without the apply worker having set them.
  if (body.status === 'submitted' && !app.applied_at) {
    updates.applied_at = now;
    updates.submission_method = app.submission_method ?? 'manual';
  }

  await db.update(applications).set(updates).where(eq(applications.id, id));
  const [updated] = await db.select().from(applications).where(eq(applications.id, id));
  return NextResponse.json({ application: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [app] = await db.select().from(applications).where(eq(applications.id, id));
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (app.status !== 'draft' && !TERMINAL_STATUSES.has(app.status)) {
    return NextResponse.json(
      { error: `Cannot delete application in status '${app.status}'. Only draft and terminal statuses can be deleted.` },
      { status: 400 }
    );
  }

  await db.delete(applications).where(eq(applications.id, id));
  return NextResponse.json({ ok: true });
}
