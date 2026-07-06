// Combines JD-text sponsorship classification with employer H-1B filing
// history and seniority detection. Used by the scrape pipeline at insert
// time and by scripts/backfill-classify.ts for existing rows.

import { getDb } from './db';
import { sponsor_history } from './schema';
import {
  classifySponsorship,
  normalizeEmployer,
  tokenJaccard,
  EMPLOYER_ALIASES,
  STAFFING_BLOCKLIST,
  type SponsorHistorySummary,
} from './sponsorship';
import { classifySeniority } from './seniority';

export interface JobClassification {
  sponsor_status: string;
  sponsor_evidence: string | null;
  sponsor_lca_count: number;
  years_required: number | null;
  entry_level: number | null;
  everify: number;
}

// In-memory history cache: employer_norm -> summary over the two most
// recent fiscal years present in sponsor_history (dol preferred over uscis
// when both cover the same employer+fy).
let historyCache: Map<string, SponsorHistorySummary> | null = null;
let firstTokenIndex: Map<string, string[]> | null = null;

async function loadHistory(): Promise<Map<string, SponsorHistorySummary>> {
  if (historyCache) return historyCache;
  const db = getDb();
  const rows = await db.select().from(sponsor_history);

  const fys = [...new Set(rows.map((r) => r.fy))].sort((a, b) => b - a).slice(0, 2);
  const recent = rows.filter((r) => fys.includes(r.fy));

  // Prefer dol over uscis for the same employer+fy
  const byKey = new Map<string, (typeof recent)[number]>();
  for (const r of recent) {
    const key = `${r.employer_norm}|${r.fy}`;
    const existing = byKey.get(key);
    if (!existing || (existing.source === 'uscis' && r.source === 'dol')) byKey.set(key, r);
  }

  const map = new Map<string, SponsorHistorySummary>();
  for (const r of byKey.values()) {
    const cur = map.get(r.employer_norm) ?? { totalLcas: 0, newEmployment: 0, techLcas: 0 };
    cur.totalLcas += r.total_lcas;
    cur.newEmployment += r.new_employment ?? 0;
    cur.techLcas += r.tech_lcas ?? 0;
    map.set(r.employer_norm, cur);
  }

  historyCache = map;
  firstTokenIndex = new Map();
  for (const norm of map.keys()) {
    const first = norm.split(' ')[0];
    if (!first) continue;
    const list = firstTokenIndex.get(first) ?? [];
    list.push(norm);
    firstTokenIndex.set(first, list);
  }
  return map;
}

/** Reset the cache (after an ingest run in the same process). */
export function resetHistoryCache() {
  historyCache = null;
  firstTokenIndex = null;
}

async function historyFor(company: string): Promise<SponsorHistorySummary | null> {
  const map = await loadHistory();
  if (map.size === 0) return null;

  let norm = normalizeEmployer(company);
  if (!norm) return null;
  norm = EMPLOYER_ALIASES[norm] ?? norm;

  for (const blocked of STAFFING_BLOCKLIST) {
    if (norm.includes(blocked)) return null;
  }

  const exact = map.get(norm);
  if (exact) return exact;

  // Fuzzy fallback among candidates sharing the first token. Job boards use
  // short names ("OpenAI") while filings use legal names ("OPENAI OPCO"), so
  // full token containment is the primary signal; when several entities
  // contain the name, the one with the most filings is the operating company.
  const candidates = firstTokenIndex?.get(norm.split(' ')[0]) ?? [];
  const normTokens = norm.split(' ').filter(Boolean);

  let bestContained: string | null = null;
  let bestVolume = -1;
  for (const cand of candidates) {
    const candTokens = new Set(cand.split(' '));
    if (!normTokens.every((t) => candTokens.has(t))) continue;
    const h = map.get(cand);
    const volume = (h?.totalLcas ?? 0) + (h?.techLcas ?? 0);
    if (volume > bestVolume) { bestVolume = volume; bestContained = cand; }
  }
  if (bestContained) return map.get(bestContained) ?? null;

  let best: string | null = null;
  let bestScore = 0;
  for (const cand of candidates) {
    const s = tokenJaccard(norm, cand);
    if (s > bestScore) { bestScore = s; best = cand; }
  }
  if (best && bestScore >= 0.85) return map.get(best) ?? null;
  return null;
}

export async function classifyJob(
  title: string,
  company: string,
  description: string | null | undefined
): Promise<JobClassification> {
  const history = await historyFor(company);
  const sponsor = classifySponsorship(description, history);
  const seniority = classifySeniority(title, description);

  return {
    sponsor_status: sponsor.status,
    sponsor_evidence: sponsor.evidence,
    sponsor_lca_count: sponsor.lcaCount,
    years_required: seniority.yearsRequired,
    entry_level: seniority.entryLevel === null ? null : seniority.entryLevel ? 1 : 0,
    everify: sponsor.everify ? 1 : 0,
  };
}
