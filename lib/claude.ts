import OpenAI from 'openai';

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
