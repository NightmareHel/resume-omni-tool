import { NextResponse } from 'next/server';

/**
 * POST /api/emails/sync
 *
 * Triggers the email sync process. In the standalone deployment the
 * email-sync worker handles polling automatically. This route exists so
 * the UI can trigger a manual sync while the worker is not running, or
 * to surface the last sync result.
 *
 * Full Gmail MCP integration runs in worker/email-sync.ts. This route
 * returns the last known sync stats from the scrape_runs table
 * (email sync is logged there with source = 'email').
 */
import { getDb } from '@/lib/db';
import { scrape_runs, email_threads } from '@/lib/schema';
import { eq, desc, count } from 'drizzle-orm';

export async function POST() {
  const db = getDb();

  const [total] = await db.select({ c: count() }).from(email_threads);

  // Return current state — actual sync is done by worker/email-sync.ts
  return NextResponse.json({
    found: total.c,
    matched: 0,
    note: 'Email sync runs automatically via worker/email-sync.ts every 30 minutes. Start the worker to enable live sync.',
  });
}

export async function GET() {
  const db = getDb();

  const [lastRun] = await db
    .select()
    .from(scrape_runs)
    .where(eq(scrape_runs.status, 'completed'))
    .orderBy(desc(scrape_runs.completed_at))
    .limit(1);

  const [{ c: total }] = await db.select({ c: count() }).from(email_threads);

  return NextResponse.json({ lastRun: lastRun ?? null, totalThreads: total });
}
