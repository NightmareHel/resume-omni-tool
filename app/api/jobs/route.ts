import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { jobs } from '@/lib/schema';
import { eq, and, gte, like, or, desc, asc, count, isNotNull, ne, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = req.nextUrl;

  const source        = searchParams.get('source');
  const status        = searchParams.get('status');
  const minScore      = searchParams.get('minScore');
  const search        = searchParams.get('search');
  const sort          = searchParams.get('sort') ?? 'scraped_at';
  const excludeCustom = searchParams.get('excludeCustom') === 'true';
  const hideBlocked   = searchParams.get('hideBlocked') === 'true';
  const entryOnly     = searchParams.get('entryOnly') === 'true';
  const sponsorStatus = searchParams.get('sponsorStatus');
  const page          = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit         = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const offset        = (page - 1) * limit;

  const filters = [];
  if (source)        filters.push(eq(jobs.source, source));
  if (excludeCustom) filters.push(ne(jobs.source, 'custom'));
  if (status)        filters.push(eq(jobs.status, status));
  if (minScore)      filters.push(gte(jobs.fit_score, parseFloat(minScore)));
  if (search) {
    const term = `%${search}%`;
    filters.push(or(like(jobs.title, term), like(jobs.company, term)));
  }
  if (sort === 'score_desc' || sort === 'score_asc') filters.push(isNotNull(jobs.fit_score));
  if (hideBlocked)   filters.push(sql`(${jobs.sponsor_status} IS NULL OR ${jobs.sponsor_status} NOT IN ('blocked', 'unlikely'))`);
  if (entryOnly)     filters.push(eq(jobs.entry_level, 1));
  if (sponsorStatus) filters.push(eq(jobs.sponsor_status, sponsorStatus));

  const where = filters.length > 0 ? and(...filters) : undefined;

  const orderBy =
    sort === 'score_desc' ? desc(jobs.fit_score) :
    sort === 'score_asc'  ? asc(jobs.fit_score)  :
    desc(jobs.scraped_at);

  const [{ total }] = await db.select({ total: count() }).from(jobs).where(where);
  const rows = await db.select().from(jobs).where(where).orderBy(orderBy).limit(limit).offset(offset);

  return NextResponse.json({ jobs: rows, total, page, limit });
}
