import { fetchJson, matchesFilter, withRetry } from './_http';
import type { RawJob, ScraperConfig } from './greenhouse';

interface AshbyJob {
  id: string;
  title: string;
  locationName?: string;
  isRemote?: boolean;
  jobUrl: string;
  descriptionPlain?: string;
  publishedAt?: string;
}

interface AshbyResponse {
  results?: AshbyJob[];
  jobs?: AshbyJob[];
}

export async function scrapeAshby(config: ScraperConfig & { slug: string }): Promise<RawJob[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${config.slug}?includeCompensation=true`;

  const data = await withRetry(() => fetchJson<AshbyResponse>(url), 2, 2000);
  const rawJobs: AshbyJob[] = data.results ?? data.jobs ?? [];

  const jobs: RawJob[] = [];

  for (const j of rawJobs) {
    if (config.titleFilter && !matchesFilter(j.title, config.titleFilter)) continue;

    const locationName = j.locationName ?? '';
    const isRemote = j.isRemote ?? /remote/i.test(locationName);

    if (config.locationFilter && config.locationFilter.length > 0) {
      const locOk = config.locationFilter.some(
        (f) => locationName.toLowerCase().includes(f.toLowerCase()) || isRemote
      );
      if (!locOk) continue;
    }

    jobs.push({
      source:      'ashby',
      external_id: j.id,
      title:       j.title,
      company:     config.company,
      location:    locationName || null,
      remote:      isRemote,
      url:         j.jobUrl,
      description: j.descriptionPlain ?? null,
      posted_at:   j.publishedAt ?? null,
    });
  }

  return jobs;
}
