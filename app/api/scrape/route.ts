import { NextRequest, NextResponse } from 'next/server';
import { scrapeAll, type ScrapeConfig } from '@/lib/scrapers/index';
import defaultConfig from '@/config/scrapers.json';
import { getDb } from '@/lib/db';
import { scrape_runs } from '@/lib/schema';
import { desc } from 'drizzle-orm';
import { uuid } from '@/lib/ids';

let scrapeInProgress = false;

export async function POST(req: NextRequest) {
  if (scrapeInProgress) {
    return NextResponse.json({ error: 'A scrape is already running' }, { status: 409 });
  }

  let body: { sources?: string[] } = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  let config: ScrapeConfig = defaultConfig as ScrapeConfig;

  if (body.sources && Array.isArray(body.sources) && body.sources.length > 0) {
    config = {
      targets: (defaultConfig as ScrapeConfig).targets.filter((t) =>
        body.sources!.includes(t.source)
      ),
    };
  }

  // Insert the run row now so we can return the real runId immediately
  const db = getDb();
  const runId = uuid();
  const sources = [...new Set(config.targets.map((t) => t.source))];
  await db.insert(scrape_runs).values({
    id: runId,
    started_at: new Date().toISOString(),
    sources: JSON.stringify(sources),
    status: 'running',
  });

  scrapeInProgress = true;
  scrapeAll(config, runId)
    .catch((err) => console.error('[scrape] Failed:', err))
    .finally(() => { scrapeInProgress = false; });

  return NextResponse.json({ runId });
}

export async function GET() {
  const db = getDb();
  const runs = await db.select().from(scrape_runs).orderBy(desc(scrape_runs.started_at));
  const latest = runs[0] ?? null;
  return NextResponse.json({ latest, total: runs.length });
}
