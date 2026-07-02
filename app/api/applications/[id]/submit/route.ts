import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { applications } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [app] = await db.select().from(applications).where(eq(applications.id, id));
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (app.status !== 'pending') {
    return NextResponse.json({ error: `Application must be in 'pending' status to submit. Current: '${app.status}'` }, { status: 400 });
  }

  // Signal the apply worker by advancing status — worker picks up 'pending' items and handles the actual form fill
  // The actual Playwright logic runs in worker/apply.ts
  return NextResponse.json({ queued: true, applicationId: id });
}
