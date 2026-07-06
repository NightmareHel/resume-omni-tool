import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { jobs, scrape_runs } from '../schema';
import { jobId, uuid } from '../ids';
import { scrapeGreenhouse } from './greenhouse';
import { scrapeLever } from './lever';
import { scrapeAshby } from './ashby';
import { scrapeWorkday } from './workday';
import type { RawJob } from './greenhouse';
import { classifyJob } from '../classify-job';

export interface ScraperTarget {
  source: 'greenhouse' | 'lever' | 'ashby' | 'workday';
  company: string;
  slug?: string;
  tenant?: string;
  titleFilter?: string[];
  locationFilter?: string[];
}

export interface ScrapeConfig {
  targets: ScraperTarget[];
}

export async function scrapeAll(config: ScrapeConfig, existingRunId?: string): Promise<{ runId: string; jobsNew: number }> {
  const db = getDb();
  const runId = existingRunId ?? uuid();
  const now = new Date().toISOString();
  const sources = [...new Set(config.targets.map((t) => t.source))];

  if (!existingRunId) {
    await db.insert(scrape_runs).values({
      id: runId,
      started_at: now,
      sources: JSON.stringify(sources),
      status: 'running',
    });
  }

  let jobsFound = 0;
  let jobsNew = 0;
  let error: string | null = null;

  try {
    const allResults: RawJob[] = [];

    await Promise.all(
      config.targets.map(async (target) => {
        try {
          let results: RawJob[] = [];

          if (target.source === 'greenhouse' && target.slug) {
            results = await scrapeGreenhouse({ company: target.company, slug: target.slug, titleFilter: target.titleFilter, locationFilter: target.locationFilter });
          } else if (target.source === 'lever' && target.slug) {
            results = await scrapeLever({ company: target.company, slug: target.slug, titleFilter: target.titleFilter, locationFilter: target.locationFilter });
          } else if (target.source === 'ashby' && target.slug) {
            results = await scrapeAshby({ company: target.company, slug: target.slug, titleFilter: target.titleFilter, locationFilter: target.locationFilter });
          } else if (target.source === 'workday' && target.tenant) {
            results = await scrapeWorkday({ company: target.company, tenant: target.tenant, titleFilter: target.titleFilter, locationFilter: target.locationFilter });
          }

          allResults.push(...results);
        } catch (err) {
          console.error(`[scraper] Failed ${target.source}/${target.company}:`, err);
        }
      })
    );

    jobsFound = allResults.length;

    const scraped_at = new Date().toISOString();

    for (const job of allResults) {
      const id = jobId(job.source, job.external_id);
      const cls = await classifyJob(job.title, job.company, job.description);
      try {
        await db.insert(jobs).values({
          id,
          source:      job.source,
          external_id: job.external_id,
          title:       job.title,
          company:     job.company,
          location:    job.location ?? undefined,
          remote:      job.remote ? 1 : 0,
          url:         job.url,
          description: job.description ?? undefined,
          posted_at:   job.posted_at ?? undefined,
          scraped_at,
          status:      'new',
          sponsor_status:    cls.sponsor_status,
          sponsor_evidence:  cls.sponsor_evidence,
          sponsor_lca_count: cls.sponsor_lca_count,
          years_required:    cls.years_required,
          entry_level:       cls.entry_level,
          everify:           cls.everify,
        });
        jobsNew++;
      } catch {
        // UNIQUE constraint — already exists, skip
      }
    }

    await db.update(scrape_runs)
      .set({ status: 'completed', completed_at: new Date().toISOString(), jobs_found: jobsFound, jobs_new: jobsNew })
      .where(eq(scrape_runs.id, runId));

  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    await db.update(scrape_runs)
      .set({ status: 'failed', completed_at: new Date().toISOString(), error })
      .where(eq(scrape_runs.id, runId));
  }

  return { runId, jobsNew };
}
