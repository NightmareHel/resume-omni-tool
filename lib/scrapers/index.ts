import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { jobs, scrape_runs } from '../schema';
import { jobId, uuid } from '../ids';
import { scrapeGreenhouse } from './greenhouse';
import { scrapeLever } from './lever';
import { scrapeAshby } from './ashby';
import { scrapeWorkday } from './workday';
import { scrapeSimplify } from './simplify';
import { scrapeWorkable } from './workable';
import { scrapeTheMuse } from './themuse';
import { scrapeSmartRecruiters } from './smartrecruiters';
import { scrapeVansh } from './vanshb03';
import { scrapeJobright } from './jobright';
import { REMOTE_API_SCRAPERS } from './remote-api';
import type { RawJob } from './greenhouse';
import { classifyJob } from '../classify-job';
import { isSeniorForNewGrad } from '../seniority';
import { isNonUsLocation } from './_http';

export interface ScraperTarget {
  source: 'greenhouse' | 'lever' | 'ashby' | 'workday' | 'simplify' | 'workable' | 'themuse' | 'smartrecruiters' | 'vanshb03' | 'jobright' | 'remotive' | 'remoteok' | 'jobicy';
  company: string;
  slug?: string;
  tenant?: string;
  titleFilter?: string[];
  locationFilter?: string[];
  searchText?: string; // workday only: server-side query for huge tenants
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
  let jobsSkipped = 0;
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
            results = await scrapeWorkday({ company: target.company, tenant: target.tenant, titleFilter: target.titleFilter, locationFilter: target.locationFilter, searchText: target.searchText });
          } else if (target.source === 'simplify') {
            results = await scrapeSimplify();
          } else if (target.source === 'workable' && target.slug) {
            results = await scrapeWorkable({ company: target.company, slug: target.slug, titleFilter: target.titleFilter, locationFilter: target.locationFilter });
          } else if (target.source === 'themuse') {
            results = await scrapeTheMuse();
          } else if (target.source === 'smartrecruiters' && target.slug) {
            results = await scrapeSmartRecruiters({ company: target.company, slug: target.slug, titleFilter: target.titleFilter, locationFilter: target.locationFilter });
          } else if (target.source === 'vanshb03') {
            results = await scrapeVansh();
          } else if (target.source === 'jobright') {
            results = await scrapeJobright();
          } else if (target.source in REMOTE_API_SCRAPERS) {
            results = await REMOTE_API_SCRAPERS[target.source]();
          }

          // Empty boards return HTTP 200 on Lever/Ashby/SmartRecruiters, so
          // health is count-based: zero results means a dead/renamed target.
          if (results.length === 0) {
            console.warn(`[scraper] HEALTH: 0 jobs from ${target.source}/${target.company} — slug may be dead`);
          }

          allResults.push(...results);
        } catch (err) {
          console.error(`[scraper] Failed ${target.source}/${target.company}:`, err);
        }
      })
    );

    const usResults = allResults.filter((j) => !isNonUsLocation(j.location));
    jobsFound = usResults.length;

    const scraped_at = new Date().toISOString();

    for (const job of usResults) {
      const id = jobId(job.source, job.external_id);
      const cls = await classifyJob(job.title, job.company, job.description);

      // Source hints override the classifier, except nothing un-blocks a
      // JD-text hard block.
      if (job.hints?.sponsor === 'blocked') {
        cls.sponsor_status = 'blocked';
        cls.sponsor_evidence = cls.sponsor_evidence ?? 'Source: does not offer sponsorship';
      } else if (job.hints?.sponsor === 'confirmed' && cls.sponsor_status !== 'blocked') {
        cls.sponsor_status = 'confirmed';
        cls.sponsor_evidence = cls.sponsor_evidence ?? 'Source: offers sponsorship';
      }
      if (job.hints?.entry && cls.entry_level === null) cls.entry_level = 1;

      // New-grad focus: never store clearly-senior roles (3+/8+ years, senior
      // JD tells). Undetermined roles are kept.
      if (isSeniorForNewGrad(cls.entry_level, cls.years_required)) {
        jobsSkipped++;
        continue;
      }

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

    console.log(`[scraper] ${jobsNew} new, ${jobsSkipped} senior roles skipped (of ${jobsFound} US postings)`);

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
