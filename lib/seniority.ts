// Entry-level detection from job title + JD text.
//
// Posting metadata lies (~24% of "entry-level" posts require 1+ years), so
// seniority is derived: title tokens give a positive signal, and max-years
// extraction from the JD overrides the title when they disagree. A "junior"
// title asking for 5+ years is not entry-level.

export interface SeniorityVerdict {
  entryLevel: boolean | null; // null = undetermined
  yearsRequired: number | null;
}

const ENTRY_TITLE: RegExp[] = [
  /\bnew\s+grad(?:uate)?\b/i,
  /\buniversity\s+grad(?:uate)?\b/i,
  /\brecent\s+grad(?:uate)?\b/i,
  /\bentry[\s-]*level\b/i,
  /\bearly\s+(?:in\s+)?career\b/i,
  /\bjunior\b/i,
  /\bassociate\s+(?:software|engineer|developer)\b/i,
  /\bcampus\b/i,
  /\b20(?:2[5-9])\b/, // cohort years in titles
  /\brotational\b/i,
  /\bresidenc[ey]\b/i,
  /\bapprentice(?:ship)?\b/i,
  /\b(?:engineer|developer|swe|sde|analyst|scientist)\s*(?:I|1)\b(?!\s*(?:I|V|\d))/i,
  /\b(?:L3|E3|IC[12])\b/,
];

const ENTRY_JD: RegExp[] = [
  /\b0\s*(?:-|–|to)\s*[12]\s*(?:\+\s*)?years?\b/i,
  /\bno\s+(?:prior\s+)?(?:professional\s+)?experience\s+(?:necessary|required)\b/i,
  /\b(?:recent\s+graduates?|new\s+grads?|graduating\s+(?:in|by|class))\b/i,
];

// Senior tells in JD body beyond years
const SENIOR_JD: RegExp[] = [
  /\bmentor(?:ing)?\s+junior\b/i,
  /\blead\s+a\s+team\b/i,
  /\bown\s+the\s+roadmap\b/i,
  /\barchitect(?:ure)?\s+decisions\b/i,
  /\bproven\s+track\s+record\b/i,
];

const YEARS_RE = /(\d{1,2})\s*(?:\+|or\s+more|plus)?\s*\+?\s*years?/gi;

/** Max years-of-experience figure mentioned in the JD, or null. */
export function extractYearsRequired(jdText: string): number | null {
  let max: number | null = null;
  for (const m of jdText.matchAll(YEARS_RE)) {
    const n = parseInt(m[1], 10);
    if (n <= 20 && (max === null || n > max)) max = n; // >20 is tenure/company-age noise
  }
  return max;
}

export function classifySeniority(title: string, jdText: string | null | undefined): SeniorityVerdict {
  const text = jdText ?? '';
  const yearsRequired = text ? extractYearsRequired(text) : null;

  const titleEntry = ENTRY_TITLE.some((re) => re.test(title));
  const jdEntry = ENTRY_JD.some((re) => re.test(text));
  const jdSenior = SENIOR_JD.some((re) => re.test(text));

  // Years override: >=3 required means not entry-level regardless of title
  if (yearsRequired !== null && yearsRequired >= 3) {
    return { entryLevel: false, yearsRequired };
  }
  if (titleEntry || jdEntry) {
    return { entryLevel: !jdSenior, yearsRequired };
  }
  if (jdSenior) return { entryLevel: false, yearsRequired };
  // 0-2 years mentioned without entry-level phrasing still leans entry
  if (yearsRequired !== null && yearsRequired <= 2) {
    return { entryLevel: true, yearsRequired };
  }
  return { entryLevel: null, yearsRequired };
}
