import OpenAI from 'openai';
import type { profile } from './schema';
import type { ResumeTailoring, ExpEntry, ProjEntry } from './profile-formatter';

type ProfileRow = typeof profile.$inferSelect;

function parseArr<T>(json: string | null): T[] {
  if (!json) return [];
  try { return JSON.parse(json) as T[]; } catch { return []; }
}

let _client: OpenAI | null = null;

function client(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return _client;
}

const MODEL = 'llama-3.3-70b-versatile';

export interface KeywordGapResult {
  mustHave: string[];
  niceToHave: string[];
  found: string[];
  missing: string[];
  suggested: { keyword: string; placement: string }[];
  score: number;
}

export interface RewriteSection {
  name: string;
  original: string;
  rewritten: string;
  changes: string[];
}

export interface RewriteResult {
  sections: RewriteSection[];
  summary: string;
}

function extractJSON(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in model response');
  return JSON.parse(match[0]);
}

export async function analyzeKeywordGap(
  resumeText: string,
  jdText: string
): Promise<KeywordGapResult> {
  const msg = await client().chat.completions.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are an expert ATS keyword analyst. Analyze this job description against the resume and return JSON only.

JOB DESCRIPTION:
${jdText}

RESUME:
${resumeText}

Return ONLY valid JSON matching this exact shape:
{
  "mustHave": ["explicitly required skills/keywords from the JD"],
  "niceToHave": ["preferred but not required skills/keywords from the JD"],
  "found": ["keywords from mustHave/niceToHave already present in the resume"],
  "missing": ["keywords from mustHave/niceToHave absent from the resume"],
  "suggested": [
    { "keyword": "Python", "placement": "Add to Skills section and mention in most recent role bullet" }
  ],
  "score": 72
}

Rules:
- Use the exact terminology from the job description, not synonyms
- score is 0-100: mustHave keywords carry 70% of the weight, niceToHave 30%
- Only include suggested entries for missing keywords`,
      },
    ],
  });

  const content = msg.choices[0].message.content;
  if (!content) throw new Error('Empty model response');
  return extractJSON(content) as KeywordGapResult;
}

export async function rewriteResume(
  resumeText: string,
  jdText: string
): Promise<RewriteResult> {
  const msg = await client().chat.completions.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are an expert resume writer. Optimize this resume for the job description below. Return JSON only.

HARD RULES — violating any of these is a failure:
1. Never fabricate experience, skills, credentials, or accomplishments. Only reframe what already exists.
2. Keep all dates, company names, job titles, and factual claims unchanged.
3. Mirror exact terminology from the JD where it truthfully applies to existing experience.
4. Lead every achievement bullet with a strong action verb and include numbers where they already appear.
5. Inject missing keywords naturally only where they honestly describe work already described.

JOB DESCRIPTION:
${jdText}

RESUME:
${resumeText}

Return ONLY valid JSON:
{
  "sections": [
    {
      "name": "Professional Summary",
      "original": "exact original text of this section",
      "rewritten": "optimized version",
      "changes": ["Short description of each specific change made"]
    }
  ],
  "summary": "2-3 sentences on what was changed overall and why"
}

Include every major section that was meaningfully changed. Sections with no improvements can be omitted.`,
      },
    ],
  });

  const content = msg.choices[0].message.content;
  if (!content) throw new Error('Empty model response');
  return extractJSON(content) as RewriteResult;
}

// Tailors ONLY the summary and existing bullet wording to a JD, keyed by index
// to the profile's experience/projects. Section structure, titles, dates, and
// entry counts are owned by the deterministic template (buildResumeText), not
// the model — so the resume can never lose a section or invent a role.
export async function tailorResume(p: ProfileRow, jdText: string): Promise<ResumeTailoring> {
  const exp = parseArr<ExpEntry>(p.experience);
  const projects = parseArr<ProjEntry>(p.projects);

  const expBlock = exp
    .map((e, i) => `[EXP ${i}] ${e.title} — ${e.company}\n${(e.bullets ?? []).map((b) => `  - ${b}`).join('\n')}`)
    .join('\n\n');
  const projBlock = projects
    .map((pr, i) => `[PROJ ${i}] ${pr.name}${pr.tech ? ` (${pr.tech})` : ''}\n${(pr.bullets ?? []).map((b) => `  - ${b}`).join('\n')}`)
    .join('\n\n');

  const msg = await client().chat.completions.create({
    model: MODEL,
    max_tokens: 3072,
    messages: [
      {
        role: 'user',
        content: `You are an expert resume writer optimizing bullets for one specific job using Google's XYZ format. Return JSON only.

XYZ FORMAT: every bullet must read as "Accomplished [X] as measured by [Y] by doing [Z]" — lead with the result/impact, then the method. Example: "Cut deal-review time ~40% by building an end-to-end ML pipeline over 500+ contracts."

HARD RULES — violating any is a failure:
1. Never fabricate experience, skills, metrics, or accomplishments. Only rephrase what already exists. If a bullet has no real metric, keep it results-first WITHOUT inventing a number.
2. Do NOT change which roles or projects exist, their titles, companies, or dates.
3. Return the SAME number of experience and project entries, in the SAME order, keyed by index.
4. KEEP every bullet for each entry (do not drop any) and do not add new ones. Rephrase each into XYZ form, leading with a strong action verb and mirroring the exact terminology from the job description WHERE it truthfully applies.
5. Keep each bullet to one line (~22 words max). Preserve any real numbers/metrics.
6. Rewrite the professional summary (2-3 sentences) to foreground the experience and skills this JD cares about, truthfully.
7. Rank the projects by relevance to THIS job in "projectOrder" (array of the project indices above, most relevant first, every index included exactly once).

JOB DESCRIPTION:
${jdText}

CURRENT SUMMARY:
${p.summary ?? ''}

EXPERIENCE:
${expBlock || '(none)'}

PROJECTS:
${projBlock || '(none)'}

Return ONLY valid JSON in this exact shape (bullets are plain strings, no leading dash):
{
  "summary": "rewritten professional summary",
  "experience": [ { "bullets": ["rewritten bullet", "rewritten bullet"] } ],
  "projects": [ { "bullets": ["rewritten bullet"] } ],
  "projectOrder": [0, 2, 1]
}
The experience array must have exactly ${exp.length} item(s) and projects exactly ${projects.length} item(s), index-aligned to the lists above. projectOrder must be a permutation of 0..${projects.length - 1}.`,
      },
    ],
  });

  const content = msg.choices[0].message.content;
  if (!content) throw new Error('Empty model response');
  const raw = extractJSON(content) as ResumeTailoring;
  const order = Array.isArray(raw.projectOrder)
    ? raw.projectOrder.filter((n) => Number.isInteger(n) && n >= 0 && n < projects.length)
    : [];
  // Ensure every project index appears exactly once (append any the model missed).
  const seen = new Set(order);
  for (let i = 0; i < projects.length; i++) if (!seen.has(i)) order.push(i);
  return {
    summary: typeof raw.summary === 'string' ? raw.summary : undefined,
    experience: Array.isArray(raw.experience) ? raw.experience : undefined,
    projects: Array.isArray(raw.projects) ? raw.projects : undefined,
    projectOrder: order,
  };
}

export async function generateCoverLetter(
  profileText: string,
  jobTitle: string,
  company: string,
  jdText: string,
  onDelta?: (text: string) => void
): Promise<string> {
  const messages = [
      {
        role: 'system',
        content:
          'You are a professional cover letter writer. Write targeted, concise cover letters in plain text. 3-4 paragraphs, under 350 words. No salutation header, no "Dear Hiring Manager" line. Start directly with the opening paragraph.',
      },
      {
        role: 'user',
        content: `Write a cover letter for the following candidate applying to this role.

CANDIDATE PROFILE:
${profileText}

ROLE: ${jobTitle} at ${company}

JOB DESCRIPTION:
${jdText}

Write the cover letter now. Plain text only, no markdown, no headers.`,
      },
    ] as const;

  if (onDelta) {
    const stream = await client().chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      max_tokens: 700,
      stream: true,
      messages: [...messages],
    });
    let full = '';
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        full += delta;
        onDelta(delta);
      }
    }
    if (!full) throw new Error('Empty model response for cover letter');
    return full.trim();
  }

  const msg = await client().chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    max_tokens: 700,
    messages: [...messages],
  });

  const content = msg.choices[0].message.content;
  if (!content) throw new Error('Empty model response for cover letter');
  return content.trim();
}

export interface ScoreResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
  sponsorship: 'yes' | 'no' | 'unclear';
  seniority: 'entry' | 'mid' | 'senior';
}

export interface CritiqueIssue {
  severity: 'high' | 'medium' | 'low';
  issue: string;
  fix: string;
}

export interface CritiqueResult {
  ats_score: number;
  issues: CritiqueIssue[];
  verdict: string;
}

export async function critiqueApplication(
  resumeText: string,
  jdText: string
): Promise<CritiqueResult> {
  const msg = await client().chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are an ATS expert reviewing a tailored resume for a specific job. Return JSON only.

JOB DESCRIPTION:
${jdText}

TAILORED RESUME:
${resumeText}

Return ONLY valid JSON:
{
  "ats_score": 82,
  "issues": [
    { "severity": "high", "issue": "Description of the problem", "fix": "Specific actionable fix" }
  ],
  "verdict": "One sentence overall assessment"
}

Rules:
- ats_score: 0-100, measures keyword alignment, formatting signals, and clarity
- severity: "high" = will cause ATS rejection, "medium" = noticeable gap, "low" = polish item
- Return 3-6 issues only, prioritize by severity
- verdict: 15 words max`,
      },
    ],
  });

  const content = msg.choices[0].message.content;
  if (!content) throw new Error('Empty model response');
  return extractJSON(content) as CritiqueResult;
}

export interface InterviewPrepResult {
  technical: { question: string; guidance: string }[];
  behavioral: { question: string; guidance: string }[];
  questions_to_ask: string[];
  talking_points: string[];
}

export async function generateInterviewPrep(
  profileText: string,
  jobTitle: string,
  company: string,
  jdText: string
): Promise<InterviewPrepResult> {
  const msg = await client().chat.completions.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are an interview coach preparing a candidate for a specific role. Return JSON only.

CANDIDATE PROFILE:
${profileText}

ROLE: ${jobTitle} at ${company}

JOB DESCRIPTION:
${jdText}

Return ONLY valid JSON:
{
  "technical": [ { "question": "likely technical question", "guidance": "how THIS candidate should answer, referencing their real experience" } ],
  "behavioral": [ { "question": "likely behavioral question", "guidance": "suggested STAR story from the candidate's actual background" } ],
  "questions_to_ask": [ "smart question the candidate should ask the interviewer" ],
  "talking_points": [ "candidate strength to weave in, tied to a JD requirement" ]
}

Rules:
- 4-6 technical questions grounded in the JD's actual stack and responsibilities
- 3-4 behavioral questions; guidance must reference the candidate's real projects/roles, never invented ones
- 3 questions_to_ask, specific to this company/team — no generic filler
- 3-4 talking_points mapping the candidate's strongest real experience to what the JD asks for
- guidance strings: 1-2 sentences, concrete`,
      },
    ],
  });

  const content = msg.choices[0].message.content;
  if (!content) throw new Error('Empty model response');
  return extractJSON(content) as InterviewPrepResult;
}

export async function scoreJob(profileText: string, jobDescription: string): Promise<ScoreResult> {
  const msg = await client().chat.completions.create({
    model: MODEL,
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: `You are a recruiter assessing candidate fit. Score this candidate against the job description. Return JSON only.

CANDIDATE PROFILE:
${profileText}

JOB DESCRIPTION:
${jobDescription}

Return ONLY valid JSON:
{
  "score": 78,
  "grade": "B",
  "summary": "One sentence on fit and main gap.",
  "sponsorship": "yes" | "no" | "unclear",
  "seniority": "entry" | "mid" | "senior"
}

Rules:
- score 0-100: 100 means perfect match on skills, experience level, and location
- grade: A (90+), B (75-89), C (60-74), D (45-59), F (<45)
- summary: maximum 20 words, specific — mention the strongest match and the biggest gap
- sponsorship: "no" ONLY if the description explicitly refuses visa sponsorship or requires US citizenship / clearance / permanent work authorization; "yes" if it explicitly offers sponsorship; otherwise "unclear". "Must be authorized to work in the US" alone is "unclear" (OPT satisfies it).
- seniority: "entry" for 0-2 years / new grad roles, "senior" for 5+ years or lead/staff scope, else "mid"`,
      },
    ],
  });

  const content = msg.choices[0].message.content;
  if (!content) throw new Error('Empty model response');
  return extractJSON(content) as ScoreResult;
}
