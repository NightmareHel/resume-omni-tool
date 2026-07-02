import { fetchJson, matchesFilter, withRetry } from './_http';
import type { RawJob } from './greenhouse';

export interface WorkdayConfig {
  company: string;
  tenant: string;
  titleFilter?: string[];
  locationFilter?: string[];
}

interface WDJob {
  id: string;
  title: string;
  locationsText?: string;
  bulletFields?: string[];
  externalPath?: string;
  postedOn?: string;
}

interface WDResponse {
  jobPostings?: WDJob[];
  total?: number;
}

export async function scrapeWorkday(config: WorkdayConfig): Promise<RawJob[]> {
  const baseUrl = `https://${config.tenant}.wd5.myworkdayjobs.com/wday/cxs/${config.tenant}/External/jobs`;
  const jobs: RawJob[] = [];
  let offset = 0;
  const limit = 20;

  while (true) {
    const body = JSON.stringify({ limit, offset, searchText: '' });

    const data = await withRetry(() =>
      fetchJson<WDResponse>(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
    );

    const postings = data.jobPostings ?? [];
    if (postings.length === 0) break;

    for (const j of postings) {
      if (config.titleFilter && !matchesFilter(j.title, config.titleFilter)) continue;

      const locationName = j.locationsText ?? '';
      const isRemote = /remote/i.test(locationName);

      if (config.locationFilter && config.locationFilter.length > 0) {
        const locOk = config.locationFilter.some(
          (f) => locationName.toLowerCase().includes(f.toLowerCase()) || isRemote
        );
        if (!locOk) continue;
      }

      const jobUrl = j.externalPath
        ? `https://${config.tenant}.wd5.myworkdayjobs.com${j.externalPath}`
        : `https://${config.tenant}.wd5.myworkdayjobs.com/External`;

      jobs.push({
        source:      'workday',
        external_id: j.id,
        title:       j.title,
        company:     config.company,
        location:    locationName || null,
        remote:      isRemote,
        url:         jobUrl,
        description: null,
        posted_at:   j.postedOn ?? null,
      });
    }

    offset += postings.length;
    if (!data.total || offset >= data.total) break;
  }

  return jobs;
}
