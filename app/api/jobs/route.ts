import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { jobs } from '@/lib/schema';
import { eq, and, gte, like, or, desc, asc, count, isNotNull } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = req.nextUrl;

  const source   = searchParams.get('source');
  const status   = searchParams.get('status');
  const minScore = searchParams.get('minScore');
  const search   = searchParams.get('search');
  const sort     = searchParams.get('sort') ?? 'scraped_at';
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit    = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const offset   = (page - 1) * limit;

  const filters = [];
  if (source)   filters.push(eq(jobs.source, source));
  if (status)   filters.push(eq(jobs.status, status));
  if (minScore) filters.push(gte(jobs.fit_score, parseFloat(minScore)));
  if (search) {
    const term = `%${search}%`;
    filters.push(or(like(jobs.title, term), like(jobs.company, term)));
  }
  if (sort === 'score_desc' || sort === 'score_asc') filters.push(isNotNull(jobs.fit_score));

  const where = filters.length > 0 ? and(...filters) : undefined;

  const orderBy =
    sort === 'score_desc' ? desc(jobs.fit_score) :
    sort === 'score_asc'  ? asc(jobs.fit_score)  :
    desc(jobs.scraped_at);

  const [{ total }] = await db.select({ total: count() }).from(jobs).where(where);
  const rows = await db.select().from(jobs).where(where).orderBy(orderBy).limit(limit).offset(offset);

  return NextResponse.json({ jobs: rows, total, page, limit });
}
