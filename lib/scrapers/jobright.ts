import { matchesTitleFilter, withRetry } from './_http';
import type { RawJob } from './greenhouse';

// jobright-ai/2026-Software-Engineer-New-Grad: markdown-table feed of curated
// new-grad SWE roles, updated multiple times daily. Rows look like:
// | **[Company](site)** | **[Title](jobright.ai/jobs/info/ID?...)** | City, ST, United States | On Site | Jul 10 |
const README_URL =
  'https://raw.githubusercontent.com/jobright-ai/2026-Software-Engineer-New-Grad/master/README.md';

const ROW_RE =
  /^\|\s*\*\*\[?([^\]|*]+)\]?(?:\([^)]*\))?\*\*\s*\|\s*\*\*\[([^\]]+)\]\(([^)]+)\)\*\*\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|?\s*$/;

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// "Jul 10" has no year — assume current year; if that lands in the future,
// it was last year.
function parsePostedDate(s: string): string | null {
  const m = /([A-Za-z]{3})\s+(\d{1,2})/.exec(s.trim());
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (month === undefined) return null;
  const now = new Date();
  let d = new Date(Date.UTC(now.getUTCFullYear(), month, parseInt(m[2], 10)));
  if (d.getTime() > now.getTime() + 86_400_000) {
    d = new Date(Date.UTC(now.getUTCFullYear() - 1, month, parseInt(m[2], 10)));
  }
  return d.toISOString();
}

export async function scrapeJobright(): Promise<RawJob[]> {
  const md = await withRetry(async () => {
    const res = await fetch(README_URL, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} from ${README_URL}`), { status: res.status });
    return res.text();
  });

  const jobs: RawJob[] = [];
  let lastCompany = '';

  for (const line of md.split('\n')) {
    const m = ROW_RE.exec(line.trim());
    if (!m) continue;

    let company = m[1].trim();
    // Continuation rows for repeat companies use ↳ instead of the name
    if (/^[↳\s]*$/.test(company)) company = lastCompany;
    else lastCompany = company;
    if (!company) continue;

    const title = m[2].trim();
    const url = m[3].trim();
    const location = m[4].trim();
    const workModel = m[5].trim();
    const posted = parsePostedDate(m[6]);

    if (!matchesTitleFilter(title)) continue; // seniority excludes only

    // jobright.ai/jobs/info/{id}
    const idMatch = /jobs\/info\/([a-f0-9]+)/i.exec(url);
    const external_id = idMatch ? idMatch[1] : url;

    jobs.push({
      source:      'jobright',
      external_id,
      title,
      company,
      location,
      remote:      /remote/i.test(workModel) || /remote/i.test(location),
      url,
      description: null,
      posted_at:   posted,
      hints:       { entry: true }, // curated new-grad list
    });
  }

  return jobs;
}
