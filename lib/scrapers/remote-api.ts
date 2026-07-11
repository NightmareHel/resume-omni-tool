import { fetchJson, matchesTitleFilter, withRetry } from './_http';
import type { RawJob } from './greenhouse';

// Free remote-job JSON APIs: Remotive, RemoteOK, Jobicy. These feeds are
// worldwide, so a US-friendly ALLOWLIST is applied here (empty/worldwide/USA
// locations pass) — the central deny-list in scrapeAll can't catch every
// foreign town name. Descriptions are included, so the classifier gets real
// JD text for sponsorship/seniority verdicts.

const US_FRIENDLY =
  /^$|usa|u\.s\.|united states|us only|northern america|north america|americas|anywhere|worldwide|global|\b(?:est|cst|mst|pst)\b/i;

// These feeds mix in sales/support/admin roles — require a dev-shaped title,
// same include list the ATS targets use in scrapers.json.
const DEV_TITLES = [
  'engineer', 'developer', 'software', 'machine learning',
  'artificial intelligence', 'data scientist', 'data analyst', 'scientist',
  'sdet', 'qa', 'devops', 'full stack', 'fullstack', 'backend', 'frontend',
];

function usFriendly(location: string | null | undefined): boolean {
  return US_FRIENDLY.test((location ?? '').trim());
}

function stripHtml(s: string | null | undefined): string | null {
  if (!s) return null;
  const text = s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  return text || null;
}

// --- Remotive ---------------------------------------------------------------

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  publication_date: string;
  candidate_required_location: string;
  description: string;
}

async function scrapeRemotive(): Promise<RawJob[]> {
  const data = await withRetry(() =>
    fetchJson<{ jobs: RemotiveJob[] }>('https://remotive.com/api/remote-jobs?category=software-dev', { timeoutMs: 60_000 })
  );
  return (data.jobs ?? [])
    .filter((j) => usFriendly(j.candidate_required_location) && matchesTitleFilter(j.title, DEV_TITLES))
    .map((j) => ({
      source:      'remotive' as const,
      external_id: String(j.id),
      title:       j.title,
      company:     j.company_name,
      location:    j.candidate_required_location || 'Remote',
      remote:      true,
      url:         j.url,
      description: stripHtml(j.description),
      posted_at:   j.publication_date ?? null,
    }));
}

// --- RemoteOK ----------------------------------------------------------------

interface RemoteOKJob {
  id?: string;
  slug?: string;
  position?: string;
  company?: string;
  location?: string;
  description?: string;
  url?: string;
  apply_url?: string;
  date?: string;
  tags?: string[];
}

async function scrapeRemoteOK(): Promise<RawJob[]> {
  const data = await withRetry(() =>
    fetchJson<RemoteOKJob[]>('https://remoteok.com/api', { timeoutMs: 60_000 })
  );
  const jobs: RawJob[] = [];
  for (const j of data) {
    if (!j.id || !j.position || !j.company) continue; // index 0 is a legal notice
    const tags = (j.tags ?? []).map((t) => t.toLowerCase());
    const isDev = tags.some((t) => ['dev', 'engineer', 'engineering', 'software', 'ai', 'ml', 'backend', 'frontend', 'full stack'].includes(t));
    if (!isDev) continue;
    if (!usFriendly(j.location) && !/united states|usa/i.test(j.location ?? '')) continue;
    if (!matchesTitleFilter(j.position, DEV_TITLES)) continue;
    jobs.push({
      source:      'remoteok',
      external_id: String(j.id),
      title:       j.position,
      company:     j.company,
      location:    j.location || 'Remote',
      remote:      true,
      url:         j.url ?? j.apply_url ?? `https://remoteok.com/l/${j.id}`,
      description: stripHtml(j.description),
      posted_at:   j.date ?? null,
    });
  }
  return jobs;
}

// --- Jobicy -------------------------------------------------------------------

interface JobicyJob {
  id: number;
  url: string;
  jobTitle: string;
  companyName: string;
  jobGeo: string;
  jobLevel?: string;
  jobDescription?: string;
  pubDate?: string;
}

async function scrapeJobicy(): Promise<RawJob[]> {
  const data = await withRetry(() =>
    fetchJson<{ jobs: JobicyJob[] }>('https://jobicy.com/api/v2/remote-jobs?count=100&industry=dev', { timeoutMs: 60_000 })
  );
  return (data.jobs ?? [])
    .filter((j) => usFriendly(j.jobGeo) && matchesTitleFilter(j.jobTitle, DEV_TITLES))
    .map((j) => ({
      source:      'jobicy' as const,
      external_id: String(j.id),
      title:       j.jobTitle,
      company:     j.companyName,
      location:    j.jobGeo || 'Remote',
      remote:      true,
      url:         j.url,
      description: stripHtml(j.jobDescription),
      posted_at:   j.pubDate ? new Date(j.pubDate).toISOString() : null,
    }));
}

// One entry point per remote API so scrape health warnings stay per-source.
export const REMOTE_API_SCRAPERS: Record<string, () => Promise<RawJob[]>> = {
  remotive: scrapeRemotive,
  remoteok: scrapeRemoteOK,
  jobicy:   scrapeJobicy,
};
