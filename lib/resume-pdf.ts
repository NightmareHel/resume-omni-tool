import { chromium } from 'playwright';
import type { profile } from './schema';
import { buildResumeText, type ResumeTailoring, type ProjEntry } from './profile-formatter';

type ProfileRow = typeof profile.$inferSelect;

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface Section {
  name: string;
  lines: string[];
}

function parseSections(text: string): Section[] {
  return text
    .split(/\n\n+/)
    .map((chunk) => {
      const [first, ...rest] = chunk.split('\n');
      return { name: first.trim(), lines: rest };
    })
    .filter((s) => s.name);
}

function cleanUrl(u: string): string {
  return u.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

type SectionKind = 'exp' | 'proj' | 'edu' | 'text';

function kindOf(name: string): SectionKind {
  const n = name.toUpperCase();
  if (n.startsWith('EXPERIENCE')) return 'exp';
  if (n.startsWith('PROJECT')) return 'proj';
  if (n.startsWith('EDUCATION')) return 'edu';
  return 'text';
}

// Section-aware renderer. Entry-header lines use the " | " convention written
// by buildResumeText; each section kind lays them out differently (experience
// right-aligns dates, projects show tech/link, education shows school/GPA).
function renderSection(name: string, lines: string[]): string {
  const kind = kindOf(name);
  let html = '';
  let inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };

  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { closeList(); continue; }

    if (t.startsWith('•') || t.startsWith('-')) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${esc(t.replace(/^[•\-]\s*/, ''))}</li>`;
      continue;
    }

    closeList();

    if (t.includes(' | ')) {
      const parts = t.split(' | ').map((s) => s.trim());
      if (kind === 'exp') {
        const title = parts[0];
        const dates = parts[parts.length - 1];
        const sub = parts.slice(1, -1).join(' · ');
        html += `<div class="entry"><div class="erow"><span class="ttl">${esc(title)}</span><span class="dt">${esc(dates)}</span></div>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>`;
      } else if (kind === 'edu') {
        const degree = parts[0];
        const sub = parts.slice(1).map(esc).join(' · ');
        html += `<div class="entry"><div class="erow"><span class="ttl">${esc(degree)}</span></div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
      } else {
        // projects: Name | tech | link
        const nameP = parts[0];
        const sub = parts.slice(1).map((s) => cleanUrl(s)).map(esc).join(' · ');
        html += `<div class="entry"><div class="erow"><span class="ttl">${esc(nameP)}</span></div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
      }
    } else {
      const cls = kind === 'edu' ? ' class="sub"' : '';
      html += `<p${cls}>${esc(t)}</p>`;
    }
  }
  closeList();
  return html;
}

function buildHTML(resumeText: string, p: ProfileRow): string {
  const contactParts = [p.email, p.phone, p.location]
    .filter(Boolean)
    .map((s) => esc(s))
    .join('  ·  ');

  const linkParts = [
    p.linkedin_url ? cleanUrl(p.linkedin_url) : null,
    p.github_url ? cleanUrl(p.github_url) : null,
    p.portfolio_url ? cleanUrl(p.portfolio_url) : null,
  ]
    .filter(Boolean)
    .map((s) => esc(s as string))
    .join('  ·  ');

  const sections = parseSections(resumeText);
  const sectionsHtml = sections
    .map(
      (s) => `
    <section>
      <h2>${esc(s.name)}</h2>
      ${renderSection(s.name, s.lines)}
    </section>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  :root { --accent: #1c2b4a; }
  @page { size: Letter; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    line-height: 1.2;
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
  }
  header { text-align: center; margin-bottom: 3pt; }
  h1 {
    font-size: 18pt;
    font-weight: 700;
    letter-spacing: 1pt;
    color: var(--accent);
    text-transform: uppercase;
    margin-bottom: 1pt;
  }
  p.contact { font-size: 9pt; color: #333; margin-bottom: 0.5pt; }
  p.links   { font-size: 9pt; color: var(--accent); }
  section { margin-bottom: 2pt; page-break-inside: avoid; }
  h2 {
    font-size: 10.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1pt;
    color: var(--accent);
    border-bottom: 1.25px solid var(--accent);
    padding-bottom: 1pt;
    margin-bottom: 2pt;
    margin-top: 5pt;
    page-break-after: avoid;
  }
  .entry { margin-top: 2.5pt; }
  .erow {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8pt;
  }
  .ttl { font-weight: 700; font-size: 10pt; color: #111; }
  .dt  { font-size: 9pt; color: #555; white-space: nowrap; }
  .sub { font-size: 9pt; color: #555; margin-bottom: 0.5pt; }
  p { margin-bottom: 1pt; }
  ul { margin: 1pt 0 1pt 14pt; padding: 0; }
  li { margin-bottom: 0.5pt; padding-left: 1pt; line-height: 1.18; }
</style>
</head>
<body>
  <header>
    <h1>${esc(p.full_name ?? '')}</h1>
    ${contactParts ? `<p class="contact">${contactParts}</p>` : ''}
    ${linkParts ? `<p class="links">${linkParts}</p>` : ''}
  </header>
  ${sectionsHtml}
</body>
</html>`;
}

// Strip stray markdown the AI sometimes emits despite the plain-text prompt.
// Conservative: only removes formatting markers, never punctuation or content.
function stripMarkdown(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*#{1,6}\s+/, '')   // leading heading markers
        .replace(/^\s*[-*+]\s+/, '')     // leading bullet markers
        .replace(/(\*\*|__)/g, '')        // bold markers
        .replace(/\*/g, '')               // stray emphasis asterisks
    )
    .join('\n');
}

function buildCoverHTML(coverText: string, p: ProfileRow): string {
  const contactParts = [p.email, p.phone, p.location]
    .filter(Boolean)
    .map(esc)
    .join(' | ');

  const normalized = stripMarkdown(coverText).replace(/\r\n/g, '\n').trim();
  let paras = normalized.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  if (paras.length === 1 && normalized.includes('\n')) {
    paras = normalized.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  }

  const paragraphs = paras.map((para) => `<p>${esc(para)}</p>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page { size: Letter; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #000; }
  .header { margin-bottom: 28pt; }
  h1 { font-size: 15pt; font-weight: bold; margin-bottom: 4pt; }
  .contact { font-size: 10pt; color: #444; }
  p { margin-bottom: 12pt; text-align: justify; }
</style>
</head>
<body>
  <div class="header">
    <h1>${esc(p.full_name ?? '')}</h1>
    ${contactParts ? `<p class="contact">${contactParts}</p>` : ''}
  </div>
  ${paragraphs}
</body>
</html>`;
}

export async function generateCoverLetterPDF(coverText: string, p: ProfileRow): Promise<Buffer> {
  const html = buildCoverHTML(coverText, p);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluateHandle('document.fonts.ready');
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function generateResumePDF(resumeText: string, p: ProfileRow): Promise<Buffer> {
  const html = buildHTML(resumeText, p);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.evaluateHandle('document.fonts.ready');
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.45in', right: '0.5in', bottom: '0.45in', left: '0.5in' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// Letter @96dpi minus the resume margins used by generateResumePDF:
// content width = 8.5in - (0.5 + 0.5)in = 720px; usable height = 11in - 0.9in = 969px.
const CONTENT_WIDTH_PX = 720;
const USABLE_HEIGHT_PX = 969;

function parseProjects(p: ProfileRow): ProjEntry[] {
  if (!p.projects) return [];
  try { return JSON.parse(p.projects) as ProjEntry[]; } catch { return []; }
}

// Relevance-first, filler-to-fill. Includes core content, then grows the number
// of projects (in relevance order) while the rendered page still fits, keeping
// the largest that fills one page. Trims bullets if even the minimum overflows.
// Returns the fitted resume_text; the PDF is rendered on demand by the .pdf route.
export async function fitResumeText(p: ProfileRow, tailoring?: ResumeTailoring): Promise<string> {
  const nProj = parseProjects(p).length;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: CONTENT_WIDTH_PX, height: 1400 });

    const measure = async (html: string): Promise<number> => {
      await page.setContent(html, { waitUntil: 'networkidle' });
      await page.evaluateHandle('document.fonts.ready');
      return page.evaluate(() => document.body.getBoundingClientRect().height);
    };

    const minProj = Math.min(nProj, 2);
    let best: string | null = null;

    // Grow projects while it still fits one page; keep the fullest fitting build.
    let bestH = 0;
    for (let limit = minProj; limit <= nProj; limit++) {
      const text = buildResumeText(p, { tailoring, projectLimit: limit });
      const h = await measure(buildHTML(text, p));
      if (process.env.FIT_DEBUG) console.error(`[fit] projects=${limit} height=${Math.round(h)}/${USABLE_HEIGHT_PX}`);
      if (h <= USABLE_HEIGHT_PX) { best = text; bestH = h; }
      else break;
    }
    if (process.env.FIT_DEBUG && best) console.error(`[fit] chosen height=${Math.round(bestH)}/${USABLE_HEIGHT_PX} fill=${Math.round((bestH / USABLE_HEIGHT_PX) * 100)}%`);

    // Even the minimum overflows → trim bullet counts until it fits.
    if (!best) {
      const trims: Array<[number, number]> = [[3, 2], [2, 2], [2, 1], [1, 1]];
      for (const [er, pr] of trims) {
        const text = buildResumeText(p, { tailoring, projectLimit: minProj, bulletsPerRole: er, bulletsPerProject: pr });
        const h = await measure(buildHTML(text, p));
        if (h <= USABLE_HEIGHT_PX) { best = text; break; }
      }
    }

    return best ?? buildResumeText(p, { tailoring, projectLimit: minProj, bulletsPerRole: 1, bulletsPerProject: 1 });
  } finally {
    await browser.close();
  }
}
