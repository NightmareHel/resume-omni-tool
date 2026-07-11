import { fetchJson, matchesTitleFilter, withRetry } from './_http';

export interface ScraperConfig {
  company: string;
  slug: string;
  titleFilter?: string[];
  locationFilter?: string[];
}

export interface RawJob {
  source: 'greenhouse' | 'lever' | 'ashby' | 'workday' | 'custom' | 'simplify' | 'workable' | 'themuse' | 'smartrecruiters' | 'vanshb03' | 'jobright' | 'remotive' | 'remoteok' | 'jobicy';
  external_id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  url: string;
  description: string | null;
  posted_at: string | null;
  // Out-of-band knowledge from the source itself (e.g. Simplify curates
  // new-grad roles and labels sponsorship). Applied on top of the classifier.
  hints?: {
    sponsor?: 'confirmed' | 'blocked';
    entry?: boolean;
  };
}

interface GHJob {
  id: number;
  title: string;
  location: { name: string };
  updated_at: string;
  absolute_url: string;
  content: string;
}

interface GHResponse {
  jobs: GHJob[];
}

export async function scrapeGreenhouse(config: ScraperConfig): Promise<RawJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${config.slug}/jobs?content=true`;

  const data = await withRetry(() => fetchJson<GHResponse>(url));
  const jobs: RawJob[] = [];

  for (const j of data.jobs) {
    if (!matchesTitleFilter(j.title, config.titleFilter)) continue;

    const locationName: string = j.location?.name ?? '';
    const isRemote = /remote/i.test(locationName);

    if (config.locationFilter && config.locationFilter.length > 0) {
      const locOk = config.locationFilter.some(
        (f) => locationName.toLowerCase().includes(f.toLowerCase()) || isRemote
      );
      if (!locOk) continue;
    }

    jobs.push({
      source:      'greenhouse',
      external_id: String(j.id),
      title:       j.title,
      company:     config.company,
      location:    locationName || null,
      remote:      isRemote,
      url:         j.absolute_url,
      description: j.content ?? null,
      posted_at:   j.updated_at ?? null,
    });
  }

  return jobs;
}
