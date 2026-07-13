import type { profile } from './schema';

type ProfileRow = typeof profile.$inferSelect;

function safeParseArray<T>(json: string | null): T[] {
  if (!json) return [];
  try { return JSON.parse(json) as T[]; } catch { return []; }
}

export interface ExpEntry { company: string; title: string; location?: string; start: string; end?: string | null; bullets?: string[] }
export interface ProjEntry { name: string; tech?: string; link?: string; bullets?: string[] }
export interface EduEntry { school: string; degree: string; end: string; gpa?: string; details?: string }

// Default one-page budget. The fill engine overrides these via BuildOpts to
// add/trim content until the rendered page is full.
const MAX_EXP_BULLETS = 3;
const MAX_PROJ_BULLETS = 2;

// Index-aligned tailoring overrides produced by tailorResume(). Structure is
// never changed by the AI — only the wording of the summary and existing
// bullets. Missing/empty entries fall back to the original profile content.
export interface ResumeTailoring {
  summary?: string;
  experience?: { bullets?: string[] }[];
  projects?: { bullets?: string[] }[];
  // Project indices in relevance order (most relevant first). The fill engine
  // includes the first N, appending the rest as filler to reach a full page.
  projectOrder?: number[];
}

// Inclusion controls used by the fill engine to size content to one page.
export interface BuildOpts {
  tailoring?: ResumeTailoring;
  projectLimit?: number;      // how many projects to include (default: all)
  bulletsPerRole?: number;    // default MAX_EXP_BULLETS
  bulletsPerProject?: number; // default MAX_PROJ_BULLETS
  skillLimit?: number;        // how many skills (default: all)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-08" -> "Aug 2026"; passes through anything that isn't YYYY-MM.
function fmtDate(s: string | null | undefined): string {
  if (!s) return '';
  const m = /^(\d{4})-(\d{2})$/.exec(s.trim());
  if (!m) return s.trim();
  const mi = parseInt(m[2], 10) - 1;
  return `${MONTHS[mi] ?? m[2]} ${m[1]}`;
}

// Graduation date: prefixes "Expected" when the YYYY-MM end date is the current
// month or later (degree not yet conferred). Past/blank dates pass through.
function fmtGradDate(s: string | null | undefined): string {
  const formatted = fmtDate(s);
  if (!formatted) return '';
  const m = /^(\d{4})-(\d{2})$/.exec((s ?? '').trim());
  if (!m) return formatted;
  const now = new Date();
  const nowKey = now.getFullYear() * 12 + now.getMonth();
  const endKey = parseInt(m[1], 10) * 12 + (parseInt(m[2], 10) - 1);
  return endKey >= nowKey ? `Expected ${formatted}` : formatted;
}

// Groups a flat skills list into ordered, labeled lines for the resume. Unknown
// skills fall into "Additional" so nothing is silently dropped.
const SKILL_GROUPS: { label: string; members: string[] }[] = [
  { label: 'AI/ML', members: ['LangChain', 'LangGraph', 'Groq API', 'Claude API (Anthropic)', 'Gemini API', 'scikit-learn', 'Multi-agent systems', 'RAG pipelines', 'Vector embeddings', 'ML pipeline engineering', 'Prompt engineering', 'Gradient Boosting', 'pandas'] },
  { label: 'Languages', members: ['Python', 'TypeScript', 'JavaScript', 'Java', 'SQL'] },
  { label: 'Frameworks & Backend', members: ['Next.js', 'React', 'React Native', 'Node.js', 'Express', 'FastAPI', 'Flask', 'Streamlit', 'REST APIs', 'SSE streaming', 'Drizzle ORM', 'SQLite', 'PostgreSQL'] },
  { label: 'Tools & Infra', members: ['Playwright', 'Git', 'GitHub', 'Vercel', 'Google Maps API', 'Canvas API', 'OAuth 2.0'] },
];

function groupSkills(skills: string[]): string[] {
  const assigned = new Set<string>();
  const lines: string[] = [];
  for (const g of SKILL_GROUPS) {
    const found = g.members.filter((m) => skills.includes(m));
    for (const m of found) assigned.add(m);
    if (found.length > 0) lines.push(`${g.label}: ${found.join(', ')}`);
  }
  const rest = skills.filter((s) => !assigned.has(s));
  if (rest.length > 0) lines.push(`Additional: ${rest.join(', ')}`);
  return lines;
}

function pickBullets(original: string[] | undefined, tailored: string[] | undefined, cap: number): string[] {
  const src = tailored && tailored.some((b) => b.trim()) ? tailored : (original ?? []);
  return src.map((b) => b.trim()).filter(Boolean).slice(0, cap);
}

// Single source of truth for the resume template. Produces the canonical ATS
// one-page layout from the profile. When `t` is supplied the AI-tailored
// summary/bullets are merged in by index; anything absent falls back to the
// original profile content, so a section can never be dropped.
export function buildResumeText(p: ProfileRow, opts: BuildOpts = {}): string {
  // Name/contact/links are NOT emitted here — the PDF template (buildHTML)
  // renders that header from the structured profile row. resume_text holds
  // only the body sections, starting at the summary.
  //
  // Each section is ONE block. parseSections() in resume-pdf splits on blank
  // lines, so blank lines must appear only BETWEEN sections — never between the
  // entries within a section, or each entry would become its own section header.
  const t = opts.tailoring;
  const expCap = opts.bulletsPerRole ?? MAX_EXP_BULLETS;
  const projCap = opts.bulletsPerProject ?? MAX_PROJ_BULLETS;
  const blocks: string[] = [];

  const summary = t?.summary?.trim() || p.summary;
  if (summary) blocks.push(`PROFESSIONAL SUMMARY\n${summary}`);

  const exp = safeParseArray<ExpEntry>(p.experience);
  if (exp.length > 0) {
    const lines = ['EXPERIENCE'];
    exp.forEach((e, i) => {
      const dates = `${fmtDate(e.start)} – ${e.end ? fmtDate(e.end) : 'Present'}`;
      // Header convention: Title | Company [| Location] | Dates (dates last).
      lines.push([e.title, e.company, e.location, dates].filter(Boolean).join(' | '));
      for (const b of pickBullets(e.bullets, t?.experience?.[i]?.bullets, expCap)) {
        lines.push(`• ${b}`);
      }
    });
    blocks.push(lines.join('\n'));
  }

  const projects = safeParseArray<ProjEntry>(p.projects);
  if (projects.length > 0) {
    // Relevance order (from tailoring) then apply the fill engine's project cap.
    const order = t?.projectOrder && t.projectOrder.length
      ? t.projectOrder.filter((i) => i >= 0 && i < projects.length)
      : projects.map((_, i) => i);
    const limit = opts.projectLimit ?? order.length;
    const chosen = order.slice(0, limit);
    if (chosen.length > 0) {
      const lines = ['PROJECTS'];
      for (const i of chosen) {
        const pr = projects[i];
        lines.push([pr.name, pr.tech, pr.link].filter(Boolean).join(' | '));
        for (const b of pickBullets(pr.bullets, t?.projects?.[i]?.bullets, projCap)) {
          lines.push(`• ${b}`);
        }
      }
      blocks.push(lines.join('\n'));
    }
  }

  const edu = safeParseArray<EduEntry>(p.education);
  if (edu.length > 0) {
    const lines = ['EDUCATION'];
    for (const e of edu) {
      lines.push([e.degree, e.school, fmtGradDate(e.end), e.gpa].filter(Boolean).join(' | '));
      if (e.details) lines.push(e.details);
    }
    blocks.push(lines.join('\n'));
  }

  const skills = safeParseArray<string>(p.skills);
  if (skills.length > 0) {
    const chosen = opts.skillLimit ? skills.slice(0, opts.skillLimit) : skills;
    blocks.push(`SKILLS\n${groupSkills(chosen).join('\n')}`);
  }

  return blocks.join('\n\n');
}

// Resume-formatted text used for tailoring input and as the untailored base
// (all content included).
export function profileToResumeText(p: ProfileRow): string {
  return buildResumeText(p);
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

  for (const pr of safeParseArray<ProjEntry>(p.projects)) {
    parts.push(`Project: ${pr.name}${pr.tech ? ` (${pr.tech})` : ''}`);
    if (pr.bullets) parts.push(pr.bullets.map((b) => `  - ${b}`).join('\n'));
  }

  const roles = safeParseArray<string>(p.target_roles);
  if (roles.length > 0) parts.push(`Target roles: ${roles.join(', ')}`);

  const locs = safeParseArray<string>(p.target_locations);
  if (locs.length > 0) parts.push(`Target locations: ${locs.join(', ')}`);

  return parts.join('\n');
}
