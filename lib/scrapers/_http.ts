const DEFAULT_UA = 'Mozilla/5.0 (compatible; JobPilot/1.0; +https://github.com/nightmarehel)';
const DEFAULT_TIMEOUT_MS = 30_000;

export async function fetchJson<T = unknown>(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: {
        'User-Agent': DEFAULT_UA,
        'Accept': 'application/json',
        ...(rest.headers ?? {}),
      },
    });

    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} from ${url}`) as Error & { status: number; retryAfter?: number };
      err.status = res.status;
      const ra = res.headers.get('Retry-After');
      if (ra) err.retryAfter = parseInt(ra, 10);
      throw err;
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

// Shared title/location filter — used by all scrapers
export function matchesFilter(value: string, filters?: string[]): boolean {
  if (!filters || filters.length === 0) return true;
  const lower = value.toLowerCase();
  return filters.some((f) => lower.includes(f.toLowerCase()));
}

// Seniority terms that disqualify a job title for a new grad search
const TITLE_EXCLUDES = [
  'senior', 'sr.', 'sr ', 'staff', 'principal', 'lead', 'manager', 'mgr',
  'director', 'head', 'vp', 'vice president', 'architect',
  'distinguished', 'intern', 'co-op',
];

// Use this instead of matchesFilter for title checks — applies seniority exclusion first
export function matchesTitleFilter(title: string, includes?: string[]): boolean {
  const lower = title.toLowerCase();
  if (TITLE_EXCLUDES.some((e) => lower.includes(e))) return false;
  return matchesFilter(title, includes);
}

// US-wide scope: drop obviously non-US postings centrally instead of
// maintaining include-lists of US cities per target. Substring hazards to
// keep in mind if editing: no bare "mexico" (New Mexico), no "georgia",
// no "ontario" (Ontario, CA).
const NON_US_LOCATION =
  /\b(?:united kingdom|london|canada|toronto|vancouver|montreal|ottawa|india|bangalore|bengaluru|hyderabad|mumbai|delhi|pune|chennai|gurgaon|noida|germany|berlin|munich|france|paris|ireland|dublin|netherlands|amsterdam|poland|warsaw|krakow|spain|madrid|barcelona|portugal|lisbon|italy|milan|rome|sweden|stockholm|switzerland|zurich|geneva|austria|vienna|belgium|brussels|denmark|copenhagen|norway|oslo|finland|helsinki|estonia|tallinn|czech|prague|romania|bucharest|hungary|budapest|greece|athens|israel|tel aviv|uae|dubai|abu dhabi|saudi|riyadh|singapore|japan|tokyo|osaka|korea|seoul|china|beijing|shanghai|shenzhen|hong kong|taiwan|taipei|australia|sydney|melbourne|brisbane|new zealand|auckland|brazil|sao paulo|são paulo|argentina|buenos aires|colombia|bogot[aá]|chile|santiago|costa rica|peru|lima|philippines|manila|vietnam|hanoi|ho chi minh|indonesia|jakarta|malaysia|kuala lumpur|thailand|bangkok|nigeria|lagos|kenya|nairobi|south africa|cape town|johannesburg|egypt|cairo|turkey|istanbul|ankara|ukraine|kyiv|serbia|belgrade|croatia|zagreb|bulgaria|sofia|slovakia|bratislava|slovenia|lithuania|vilnius|latvia|riga|luxembourg|mexico city|emea|europe|apac|latam)\b/i;

export function isNonUsLocation(location: string | null | undefined): boolean {
  if (!location) return false;
  return NON_US_LOCATION.test(location);
}

// Exponential backoff with jitter. Respects Retry-After header on 429s.
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelayMs = 1000
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i >= retries) break;

      const typedErr = err as { status?: number; retryAfter?: number };
      // Don't retry client errors (4xx except 429)
      if (typedErr.status && typedErr.status >= 400 && typedErr.status !== 429) break;

      // Respect Retry-After if present (in seconds)
      const waitMs = typedErr.retryAfter
        ? typedErr.retryAfter * 1000
        : Math.min(baseDelayMs * Math.pow(2, i) + Math.random() * 500, 30_000);

      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}
