import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { email_threads } from '@/lib/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  const db = getDb();
  const threads = await db
    .select()
    .from(email_threads)
    .orderBy(desc(email_threads.received_at));

  return NextResponse.json({ threads });
}
