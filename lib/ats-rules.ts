export interface ATSCheck {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'unknown';
  message: string;
  impact: 'high' | 'medium' | 'low';
}

export interface ATSResult {
  score: number;
  checks: ATSCheck[];
}

export interface ParsedResume {
  text: string;
  hasTables: boolean;
  hasMultiColumn: boolean;
  hasHeaderFooter: boolean;
  fileType: 'pdf' | 'docx' | 'text';
}

const STANDARD_SECTIONS = [
  { patterns: ['experience', 'work experience', 'employment', 'work history'], name: 'Experience' },
  { patterns: ['education', 'academic background', 'academics'], name: 'Education' },
  { patterns: ['skills', 'core competencies', 'technical skills', 'competencies'], name: 'Skills' },
];

const NON_STANDARD_HEADERS = [
  'background', 'credentials', 'career background',
  'professional background', 'career history', 'work background',
];

function countQuantifiedBullets(text: string): { quantified: number; total: number } {
  const lines = text.split('\n');
  const bulletLines = lines.filter(l => /^\s*[•\-–—*▸►▪▫◦‣⁃]\s+.{10,}/.test(l));
  const quantified = bulletLines.filter(l => /\d+/.test(l)).length;
  return { quantified, total: bulletLines.length };
}

function hasContactInfo(text: string): boolean {
  const firstBlock = text.split('\n').slice(0, 15).join('\n');
  const hasEmail = /@[a-z0-9.-]+\.[a-z]{2,}/i.test(firstBlock);
  const hasPhone = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(firstBlock);
  return hasEmail && hasPhone;
}

function findNonStandardHeaders(text: string): string[] {
  const lines = text.split('\n');
  const found: string[] = [];
  for (const line of lines) {
    const clean = line.trim().toLowerCase();
    if (clean.length > 3 && clean.length < 40) {
      for (const bad of NON_STANDARD_HEADERS) {
        if (clean === bad || clean.startsWith(bad + ':') || clean.startsWith(bad + ' ')) {
          found.push(line.trim());
        }
      }
    }
  }
  return [...new Set(found)];
}

const WEIGHTS: Record<string, number> = {
  'file-format': 5,
  'no-tables': 15,
  'single-column': 15,
  'no-header-footer': 10,
  'contact-info': 10,
  'section-headers': 15,
  'no-nonstandard-headers': 5,
  'quantification': 10,
  'skills-section': 10,
  'resume-length': 5,
};

export function runATSAudit(parsed: ParsedResume): ATSResult {
  const checks: ATSCheck[] = [];
  const lower = parsed.text.toLowerCase();

  checks.push({
    id: 'file-format',
    name: 'File Format',
    status: parsed.fileType === 'docx' ? 'pass' : 'warn',
    message: parsed.fileType === 'docx'
      ? 'DOCX format — best ATS compatibility across all major platforms.'
      : parsed.fileType === 'pdf'
      ? 'PDF detected. Most modern ATS can parse text PDFs, but DOCX is safer for Workday and Taleo.'
      : 'Pasted text. Content checks apply. Submit as DOCX when applying.',
    impact: 'medium',
  });

  checks.push({
    id: 'no-tables',
    name: 'No Tables',
    status: parsed.hasTables ? 'fail' : 'pass',
    message: parsed.hasTables
      ? 'Tables detected. ATS reads tables row-by-row and merges columns into jumbled text. Replace with plain bullet lists.'
      : 'No tables detected.',
    impact: 'high',
  });

  checks.push({
    id: 'single-column',
    name: 'Single-Column Layout',
    status: parsed.hasMultiColumn ? 'fail' : 'pass',
    message: parsed.hasMultiColumn
      ? 'Multi-column layout or text boxes detected. ATS reads columns out of order. Use a single-column layout.'
      : 'Single-column layout confirmed.',
    impact: 'high',
  });

  checks.push({
    id: 'no-header-footer',
    name: 'No Content in Headers/Footers',
    status: parsed.hasHeaderFooter ? 'fail' : 'pass',
    message: parsed.hasHeaderFooter
      ? 'Content found in document headers or footers. ATS frequently skips these — move contact info to the body.'
      : 'No headers or footers with content detected.',
    impact: 'high',
  });

  const hasContact = hasContactInfo(parsed.text);
  checks.push({
    id: 'contact-info',
    name: 'Contact Info at Top',
    status: hasContact ? 'pass' : 'fail',
    message: hasContact
      ? 'Email and phone found near the top in plain text.'
      : 'Email or phone not found in the first 15 lines. ATS expects contact info at the top in body text, not in a header.',
    impact: 'high',
  });

  const foundSections = STANDARD_SECTIONS.filter(s => s.patterns.some(p => lower.includes(p)));
  const missingSections = STANDARD_SECTIONS.filter(s => !s.patterns.some(p => lower.includes(p)));
  checks.push({
    id: 'section-headers',
    name: 'Standard Section Headers',
    status: missingSections.length === 0 ? 'pass' : missingSections.length === 1 ? 'warn' : 'fail',
    message: missingSections.length === 0
      ? `All standard sections found: ${foundSections.map(s => s.name).join(', ')}.`
      : `Missing sections: ${missingSections.map(s => s.name).join(', ')}. ATS NLP expects these exact headers to properly extract your content.`,
    impact: 'high',
  });

  const nonStandard = findNonStandardHeaders(parsed.text);
  checks.push({
    id: 'no-nonstandard-headers',
    name: 'No Unconventional Section Names',
    status: nonStandard.length === 0 ? 'pass' : 'warn',
    message: nonStandard.length === 0
      ? 'No unconventional section headers detected.'
      : `Unconventional headers: "${nonStandard.join('", "')}". Replace with standard names like Experience, Education, Skills.`,
    impact: 'medium',
  });

  const { quantified, total } = countQuantifiedBullets(parsed.text);
  const quantRate = total > 0 ? Math.round((quantified / total) * 100) : 0;
  checks.push({
    id: 'quantification',
    name: 'Quantified Achievements',
    status: total === 0 ? 'warn' : quantRate >= 40 ? 'pass' : quantRate >= 20 ? 'warn' : 'fail',
    message: total === 0
      ? 'No bullet points detected. Add achievement bullets to your experience entries.'
      : `${quantified}/${total} bullets (${quantRate}%) include measurable outcomes. Aim for 40%+ for max ATS and recruiter impact.`,
    impact: 'medium',
  });

  const hasSkills = /skills|competencies/i.test(parsed.text);
  checks.push({
    id: 'skills-section',
    name: 'Skills Section',
    status: hasSkills ? 'pass' : 'fail',
    message: hasSkills
      ? 'Skills or competencies section found. ATS indexes this section heavily for keyword matching.'
      : 'No skills section detected. Add a "Skills" section with 10-15 role-relevant keywords near the top.',
    impact: 'high',
  });

  const wordCount = parsed.text.split(/\s+/).filter(Boolean).length;
  checks.push({
    id: 'resume-length',
    name: 'Resume Length',
    status: wordCount < 200 ? 'warn' : wordCount > 1200 ? 'warn' : 'pass',
    message: wordCount < 200
      ? `Very short (~${wordCount} words). A complete resume typically runs 400-700 words per page.`
      : wordCount > 1200
      ? `Long resume (~${wordCount} words). Consider trimming — recruiters skim, and over 2 pages increases drop-off.`
      : `Good length — approximately ${wordCount} words.`,
    impact: 'low',
  });

  let score = 0;
  for (const check of checks) {
    const w = WEIGHTS[check.id] ?? 5;
    if (check.status === 'pass') score += w;
    else if (check.status === 'warn') score += w * 0.5;
  }

  return { score: Math.round(score), checks };
}
