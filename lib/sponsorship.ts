// Sponsorship classification for OPT/H-1B job seekers.
//
// Verdicts come from two signals, JD text regexes and employer H-1B filing
// history (sponsor_history table, fed by DOL LCA + USCIS Data Hub files).
// A tier-1 negative always wins: "US citizens only" can never be upgraded
// by filing history or by the LLM cross-check.
//
// Key framing: the user has ~3 years of day-1 work authorization (STEM OPT),
// so "must be authorized to work in the US" is satisfiable and only a weak
// negative. The hard blockers are future-sponsorship refusals, citizenship /
// clearance / ITAR requirements, and explicit OPT exclusions.

export type SponsorStatus = 'blocked' | 'confirmed' | 'likely' | 'possible' | 'unlikely' | 'unknown';

export interface SponsorHistorySummary {
  totalLcas: number;      // certified H-1B LCAs, last 2 FYs
  newEmployment: number;  // NEW_EMPLOYMENT sum, last 2 FYs
  techLcas: number;       // SOC 15-xxxx rows, last 2 FYs
}

export interface SponsorVerdict {
  status: SponsorStatus;
  evidence: string | null; // verbatim matched JD phrase, if any
  everify: boolean;
  lcaCount: number;
}

// Tier 1 negative: hard block (~0.95 confidence)
const HARD_NO: RegExp[] = [
  // "unable/will not/cannot sponsor", all inflections, optional filler
  /\b(?:un(?:able|willing)|not\s+able|(?:will|can|do(?:es)?)\s*n[o']t(?:\s+be\s+able)?)\s+to\s+(?:offer|provide|consider|support|petition|sponsor)[\s\S]{0,40}?(?:sponsor|visa|immigration|work\s+authorization)/i,
  /\b(?:will|wo|do(?:es)?|can)\s*n[o']t\s+(?:be\s+able\s+to\s+)?sponsor\b/i,
  /\bcan\s*not\s+sponsor\b/i,
  /\bsponsorship\s+is\s+not\s+(?:available|offered|provided)\b/i,
  /\bno\s+(?:visa|h-?1b|immigration)\s+sponsorship\b/i,
  /\bnot\s+eligible\s+for\s+(?:visa|immigration|employment\s+visa)\s+sponsorship\b/i,
  /\b(?:unable\s+to|cannot|will\s+not)\s+(?:sponsor\s+or\s+)?take\s*over\s+sponsorship\b/i,
  // the "now or in the future" clause blocks OPT holders specifically
  /\bwithout\s+(?:the\s+need\s+(?:for|of)\s+)?(?:visa\s+|employer\s+|employment\s+)?sponsorship[,\s]+(?:now\s+(?:or|and)\s+in\s+the\s+future|either\s+now\s+or)/i,
  /\bnot\s+require\s+(?:visa\s+)?sponsorship\s+(?:now\s+or\s+)?in\s+the\s+future\b/i,
  // citizenship / green card requirements
  /\b(?:must\s+be|only)\s+(?:a\s+)?u\.?s\.?\s+citizens?\b/i,
  /\bu\.?s\.?\s+citizens?\s+only\b/i,
  /\b(?:open|limited|restricted)\s+to\s+u\.?s\.?\s+citizens?\b/i,
  /\bu\.?s\.?\s+citizenship\s+(?:is\s+)?required\b/i,
  /\bcitizens?\s+(?:or|and)\s+(?:green\s*card\s+holders?|permanent\s+residents?)\s+only\b/i,
  /\busc\s*\/\s*gc\s+only\b/i, // staffing-agency shorthand
  /\bno\s+(?:opt|cpt|opt\s*\/\s*cpt|f-?1)\b/i,
  /\bpermanent\s+(?:work\s+)?authorization\b/i, // OPT is temporary; this excludes it
  /\bunrestricted\s+(?:right|authorization)\s+to\s+work\b/i,
  // clearance requires citizenship
  /\b(?:active|current)\s+(?:secret|top\s*secret|ts\/?sci|dod)\s+(?:security\s+)?clearance\b/i,
  /\b(?:ability|eligib\w+)\s+to\s+obtain\s+a?\s*(?:security\s+)?clearance\b/i,
  // ITAR / export control "US person" excludes OPT students
  /\bITAR\b/,
  /\bexport\s+control(?:led)?\s+(?:laws?|regulations?|requirements?)\b/i,
  /\bu\.?s\.?\s+persons?\s+(?:as\s+defined|status|requirement|only)\b/i,
  /\b22\s+C\.?F\.?R\.?\b|\b8\s+U\.?S\.?C\.?\s*(?:§\s*)?1324b\b/i,
];

// Tier 2 negative: deprioritize, don't block (~0.5 confidence).
// "Must be authorized to work" is the most recycled template line in job
// postings; OPT satisfies it and many such companies still sponsor. Weak
// evidence only — strong LCA history overrides it.
const SOFT_NO: RegExp[] = [
  /\bmust\s+be\s+(?:legally\s+)?authorized\s+to\s+work\s+in\s+the\s+u(?:\.s\.?|nited\s+states)\b/i,
  /\bwork\s+authorization\s+(?:that\s+does\s+not\s+)?requir\w+\s+(?:at\s+the\s+time\s+of\s+hire|sponsorship)\b/i,
  /\b(?:citizens?|permanent\s+residents?)\s+(?:are\s+)?preferred\b/i,
  /\bpublic\s+trust\b/i,
  /\bgovernment\s+contract\s+requir/i,
];

// Tier 1 positive (~0.9 confidence)
const YES: RegExp[] = [
  /\b(?:visa|h-?1b|immigration)\s+sponsorship\s+(?:is\s+)?(?:available|offered|provided|possible)\b/i,
  /\b(?:will|willing\s+to|able\s+to|can|do(?:es)?|happy\s+to)\s+(?:provide\s+|offer\s+)?sponsor/i,
  /\bh-?1b\s+transfers?\s*(?:accepted|welcome|supported|ok)?\b/i,
  /\bopt\s*(?:\/|and|or)?\s*cpt\s+(?:candidates?\s+)?(?:are\s+)?welcome\b/i,
  /\bsupports?\s+(?:work\s+)?visas?\b/i,
  /\bopen\s+to\s+(?:candidates|applicants)\s+(?:who|that)\s+(?:require|need)\s+sponsorship\b/i,
  /\bimmigration\s+support\b/i,
];

const EVERIFY = /\be-?verify\b/i;

// Guard a positive match against a preceding negation ("will not sponsor"
// would otherwise hit the `will ... sponsor` positive).
const NEGATION_BEFORE = /\b(?:not?|unable|cannot|won't|un)\b[^.]{0,30}$/i;

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

function firstPositiveMatch(text: string): string | null {
  for (const re of YES) {
    const m = re.exec(text);
    if (!m) continue;
    const before = text.slice(Math.max(0, m.index - 30), m.index);
    if (NEGATION_BEFORE.test(before)) continue;
    return m[0];
  }
  return null;
}

/**
 * Classify a job's sponsorship friendliness from JD text + employer filing
 * history. History thresholds: >=10 certified tech LCAs with new employment
 * in the last 2 FYs = strong; any history = some.
 */
export function classifySponsorship(
  jdText: string | null | undefined,
  history: SponsorHistorySummary | null
): SponsorVerdict {
  const text = jdText ?? '';
  const everify = EVERIFY.test(text);
  const lcaCount = history?.techLcas ?? 0;

  const hardNo = firstMatch(text, HARD_NO);
  if (hardNo) return { status: 'blocked', evidence: hardNo, everify, lcaCount };

  const yes = firstPositiveMatch(text);
  if (yes) return { status: 'confirmed', evidence: yes, everify, lcaCount };

  const strongHistory = history !== null && history.techLcas >= 10 && history.newEmployment > 0;
  const someHistory = history !== null && history.totalLcas > 0;

  const softNo = firstMatch(text, SOFT_NO);
  if (softNo) {
    // Strong filing history overrides template no-sponsorship boilerplate
    if (strongHistory) return { status: 'possible', evidence: softNo, everify, lcaCount };
    return { status: 'unlikely', evidence: softNo, everify, lcaCount };
  }

  // Silent JD: verdict comes from employer history alone
  if (strongHistory) return { status: 'likely', evidence: null, everify, lcaCount };
  if (someHistory) return { status: 'possible', evidence: null, everify, lcaCount };
  return { status: 'unknown', evidence: null, everify, lcaCount };
}

// ---------------------------------------------------------------------------
// Employer name normalization + matching
// ---------------------------------------------------------------------------

const LEGAL_SUFFIXES =
  /\b(?:INC(?:ORPORATED)?|LLC|L\s?L\s?C|CORP(?:ORATION)?|CO|COMPANY|LTD|LIMITED|LP|LLP|PLLC|PBC|GROUP|HOLDINGS?|USA|US|AMERICA|NORTH\s+AMERICA|SERVICES|TECHNOLOGIES|TECHNOLOGY|LABS)\b\.?/g;

/** Normalize an employer name for matching against sponsor_history. */
export function normalizeEmployer(name: string): string {
  let n = name.toUpperCase();
  const dba = n.split(/\s+DBA\s+/);
  n = dba[dba.length - 1]; // prefer the operating name
  n = n.replace(/[^\w\s]/g, ' ');
  n = n.replace(LEGAL_SUFFIXES, ' ');
  n = n.replace(/^THE\s+/, '');
  return n.replace(/\s+/g, ' ').trim();
}

// Big/odd employers whose job-board name differs from their LCA filing name.
export const EMPLOYER_ALIASES: Record<string, string> = {
  GOOGLE: 'GOOGLE',
  META: 'META PLATFORMS',
  FACEBOOK: 'META PLATFORMS',
  AMAZON: 'AMAZON COM',
  AWS: 'AMAZON WEB',
  'X AI': 'X AI',
  XAI: 'X AI',
  HRT: 'HUDSON RIVER TRADING',
  'HUDSON RIVER TRADING': 'HUDSON RIVER TRADING',
  DRW: 'DRW',
  'C3 AI': 'C3 AI',
  C3IOT: 'C3 AI',
  'OSCAR HEALTH': 'OSCAR',
  'CAPITAL ONE': 'CAPITAL ONE',
  IBM: 'INTERNATIONAL BUSINESS MACHINES',
};

// Staffing agencies dominate LCA volume; their filings say nothing about a
// client company's willingness to sponsor a direct hire. Never let their
// history credit a posting.
export const STAFFING_BLOCKLIST = new Set([
  'INFOSYS', 'TATA CONSULTANCY', 'TCS', 'COGNIZANT', 'WIPRO', 'HCL', 'CAPGEMINI',
  'ACCENTURE', 'DELOITTE CONSULTING', 'TECH MAHINDRA', 'LTIMINDTREE', 'MINDTREE',
  'SYNTEL', 'MPHASIS', 'UST GLOBAL', 'RANDSTAD', 'INSIGHT GLOBAL', 'COLLABERA',
]);

/** Token-set Jaccard similarity between two normalized names. */
export function tokenJaccard(a: string, b: string): number {
  const ta = new Set(a.split(' ').filter(Boolean));
  const tb = new Set(b.split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}
