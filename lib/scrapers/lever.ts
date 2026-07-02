import { fetchJson, matchesFilter, withRetry } from './_http';
import type { RawJob, ScraperConfig } from './greenhouse';

interface LeverJob {
  id: string;
  text: string;
  categories: { location?: string; commitment?: string; team?: string };
  hostedUrl: string;
  descriptionPlain: string;
  createdAt: number;
  salaryRange?: { currency: string; interval: string; min: number; max: number };
  salaryDescription?: string;
}

const PAGE_LIMIT = 250;

export async function scrapeLever(config: ScraperConfig & { slug: string }): Promise<RawJob[]> {
  const jobs: RawJob[] = [];
  let skip = 0;

  // Lever paginates via skip/limit. Default truncates at ~250 without pagination.
  while (true) {
    const url = `https://api.lever.co/v0/postings/${config.slug}?mode=json&limit=${PAGE_LIMIT}&skip=${skip}`;
    const page = await withRetry(() => fetchJson<LeverJob[]>(url));
    if (!Array.isArray(page) || page.length === 0) break;

    for (const j of page) {
      if (config.titleFilter && !matchesFilter(j.text, config.titleFilter)) continue;

      const locationName = j.categories?.location ?? '';
      const isRemote = /remote/i.test(locationName);

      if (config.locationFilter && config.locationFilter.length > 0) {
        const locOk = config.locationFilter.some(
          (f) => locationName.toLowerCase().includes(f.toLowerCase()) || isRemote
        );
        if (!locOk) continue;
      }

      jobs.push({
        source:      'lever',
        external_id: j.id,
        title:       j.text,
        company:     config.company,
        location:    locationName || null,
        remote:      isRemote,
        url:         j.hostedUrl,
        description: j.descriptionPlain ?? null,
        posted_at:   j.createdAt ? new Date(j.createdAt).toISOString() : null,
      });
    }

    // If we got fewer results than the page limit, we've reached the end
    if (page.length < PAGE_LIMIT) break;
    skip += page.length;
  }

  return jobs;
}
