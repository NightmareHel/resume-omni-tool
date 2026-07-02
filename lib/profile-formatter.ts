import type { profile } from './schema';

type ProfileRow = typeof profile.$inferSelect;

function safeParseArray<T>(json: string | null): T[] {
  if (!json) return [];
  try { return JSON.parse(json) as T[]; } catch { return []; }
}

interface ExpEntry { company: string; title: string; start: string; end?: string | null; bullets?: string[] }
interface EduEntry { school: string; degree: string; end: string }

// Resume-formatted text used for tailoring (rich, section-by-section)
export function profileToResumeText(p: ProfileRow): string {
  const parts: string[] = [];

  if (p.full_name) parts.push(p.full_name);
  const contact = [p.email, p.phone, p.location].filter(Boolean).join(' | ');
  if (contact) parts.push(contact);
  if (p.linkedin_url)   parts.push(`LinkedIn: ${p.linkedin_url}`);
  if (p.github_url)     parts.push(`GitHub: ${p.github_url}`);
  if (p.portfolio_url)  parts.push(`Portfolio: ${p.portfolio_url}`);
  parts.push('');

  if (p.summary) {
    parts.push('PROFESSIONAL SUMMARY');
    parts.push(p.summary);
    parts.push('');
  }

  const exp = safeParseArray<ExpEntry>(p.experience);
  if (exp.length > 0) {
    parts.push('EXPERIENCE');
    for (const e of exp) {
      parts.push(`${e.title} | ${e.company} | ${e.start} – ${e.end ?? 'Present'}`);
      if (e.bullets) parts.push(...e.bullets.map((b) => `• ${b}`));
      parts.push('');
    }
  }

  const skills = safeParseArray<string>(p.skills);
  if (skills.length > 0) {
    parts.push('SKILLS');
    parts.push(skills.join(', '));
    parts.push('');
  }

  const edu = safeParseArray<EduEntry>(p.education);
  if (edu.length > 0) {
    parts.push('EDUCATION');
    for (const e of edu) parts.push(`${e.degree} | ${e.school} | ${e.end}`);
  }

  return parts.join('\n');
}

// Compact text used for scoring (token-efficient)
export function profileToScoreText(p: ProfileRow): string {
  const parts: string[] = [];

  if (p.full_name)  parts.push(`Name: ${p.full_name}`);
  if (p.summary)    parts.push(`Summary: ${p.summary}`);

  const skills = safeParseArray<string>(p.skills);
  if (skills.length > 0) parts.push(`Skills: ${skills.join(', ')}`);

  for (const e of safeParseArray<ExpEntry>(p.experience)) {
    parts.push(`Experience: ${e.title} at ${e.company}`);
    if (e.bullets) parts.push(e.bullets.map((b) => `  - ${b}`).join('\n'));
  }

  const roles = safeParseArray<string>(p.target_roles);
  if (roles.length > 0) parts.push(`Target roles: ${roles.join(', ')}`);

  const locs = safeParseArray<string>(p.target_locations);
  if (locs.length > 0) parts.push(`Target locations: ${locs.join(', ')}`);

  return parts.join('\n');
}
