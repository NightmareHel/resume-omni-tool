import { chromium } from 'playwright';
import type { profile } from './schema';

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

function renderSectionContent(lines: string[]): string {
  let html = '';
  let inList = false;

  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (inList) { html += '</ul>'; inList = false; }
      continue;
    }
    if (t.startsWith('•') || t.startsWith('-')) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${esc(t.replace(/^[•\-]\s*/, ''))}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (t.includes(' | ') || t.includes(' – ') || t.includes(' - ')) {
        html += `<p class="entry-header">${esc(t)}</p>`;
      } else {
        html += `<p>${esc(t)}</p>`;
      }
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function buildHTML(resumeText: string, p: ProfileRow): string {
  const contactParts = [p.email, p.phone, p.location]
    .filter(Boolean)
    .map(esc)
    .join(' | ');

  const linkParts = [
    p.linkedin_url ? `LinkedIn: ${esc(p.linkedin_url)}` : null,
    p.github_url ? `GitHub: ${esc(p.github_url)}` : null,
    p.portfolio_url ? `Portfolio: ${esc(p.portfolio_url)}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const sections = parseSections(resumeText);
  const sectionsHtml = sections
    .map(
      (s) => `
    <section>
      <h2>${esc(s.name)}</h2>
      ${renderSectionContent(s.lines)}
    </section>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page { size: Letter; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.35;
    color: #000;
    -webkit-print-color-adjust: exact;
  }
  h1 {
    font-size: 18pt;
    font-weight: bold;
    margin-bottom: 2pt;
    letter-spacing: 0.5pt;
  }
  p.contact { font-size: 10pt; margin-bottom: 1pt; }
  p.links   { font-size: 9.5pt; color: #333; margin-bottom: 2pt; }
  section { margin-bottom: 4pt; }
  h2 {
    font-size: 12pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5pt;
    border-bottom: 1px solid #000;
    padding-bottom: 2pt;
    margin-bottom: 4pt;
    margin-top: 8pt;
  }
  p { margin-bottom: 2pt; }
  p.entry-header {
    font-weight: bold;
    margin-top: 5pt;
    margin-bottom: 1pt;
  }
  ul {
    margin: 2pt 0 4pt 16pt;
    padding: 0;
  }
  li { margin-bottom: 1pt; }
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
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
