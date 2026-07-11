import { fetchJson, matchesTitleFilter, withRetry } from './_http';
import type { RawJob } from './greenhouse';

// vanshb03/New-Grad-2026: community-curated new-grad list (WeCracked /
// Resumes.fyi). Same feed shape as SimplifyJobs (fork lineage) but without
// the category field. US/Remote only by curation; every entry is new-grad.
const FEED_URL =
  'https://raw.githubusercontent.com/vanshb03/New-Grad-2026/dev/.github/scripts/listings.json';

interface VanshListing {
  id: string;
  company_name: string;
  title: string;
  url: string;
  locations: string[];
  active: boolean;
  date_posted: number; // unix seconds
  sponsorship?: string; // "Offers Sponsorship" | "Does Not Offer Sponsorship" | "U.S. Citizenship is Required" | "Other"
}

export async function scrapeVansh(): Promise<RawJob[]> {
  const listings = await withRetry(() => fetchJson<VanshListing[]>(FEED_URL, { timeoutMs: 120_000 }));
  const jobs: RawJob[] = [];

  for (const l of listings) {
    if (!l.active) continue;
    if (l.sponsorship === 'U.S. Citizenship is Required') continue;
    if (!matchesTitleFilter(l.title)) continue; // seniority excludes only

    const location = l.locations?.join('; ') || null;
    const isRemote = /remote/i.test(location ?? '');

    const hints: RawJob['hints'] = { entry: true };
    if (l.sponsorship === 'Offers Sponsorship') hints.sponsor = 'confirmed';
    else if (l.sponsorship === 'Does Not Offer Sponsorship') hints.sponsor = 'blocked';

    jobs.push({
      source:      'vanshb03',
      external_id: l.id,
      title:       l.title,
      company:     l.company_name,
      location,
      remote:      isRemote,
      url:         l.url,
      description: null,
      posted_at:   l.date_posted ? new Date(l.date_posted * 1000).toISOString() : null,
      hints,
    });
  }

  return jobs;
}
