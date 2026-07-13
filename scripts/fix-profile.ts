// One-off, idempotent profile corrections that the ProfileEditor UI cannot make:
//   1. Major GPA typo 3.59 -> 3.69
//   2. Trim the 2021 SAP CTO-shadowing entry to a header-only relationship signal
//   3. Curate the skills list: drop low-signal infra trivia, move AI/ML to the front
// Run: npx tsx scripts/fix-profile.ts
import Database from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH ?? 'data/jobs.db';

interface ExpEntry { company: string; title: string; start: string; bullets?: string[] }
interface EduEntry { degree: string; gpa?: string }

const DROP_SKILLS = new Set(['PM2', 'Vultr', 'Railway']);
const AIML = [
  'LangChain', 'LangGraph', 'Groq API', 'Claude API (Anthropic)', 'Gemini API', 'scikit-learn',
  'Multi-agent systems', 'RAG pipelines', 'Vector embeddings', 'ML pipeline engineering',
  'Prompt engineering', 'Gradient Boosting',
];

function main() {
  const db = new Database(DB_PATH);
  const row = db.prepare("SELECT education, experience, skills FROM profile WHERE id = 'default'").get() as
    { education: string; experience: string; skills: string } | undefined;
  if (!row) { console.error('No profile row (id=default) found.'); process.exit(1); }

  const edu = JSON.parse(row.education) as EduEntry[];
  const exp = JSON.parse(row.experience) as ExpEntry[];
  const skills = JSON.parse(row.skills) as string[];

  console.log('BEFORE:');
  console.log('  GPA:', edu[0]?.gpa);
  console.log('  2021 entry bullets:', exp.find((e) => e.start === '2021-07')?.bullets?.length ?? 0);
  console.log('  skills count:', skills.length);

  // 1. GPA
  if (edu[0]?.gpa) edu[0].gpa = edu[0].gpa.replace('3.59 Major', '3.69 Major');

  // 2. Trim 2021 SAP shadowing bullets (keep the header line)
  for (const e of exp) {
    if (e.start === '2021-07' && e.company === 'SAP') e.bullets = [];
  }

  // 3. Curate + reorder skills (AI/ML first, then the rest in original order)
  const kept = skills.filter((s) => !DROP_SKILLS.has(s));
  const aiFirst = [
    ...AIML.filter((s) => kept.includes(s)),
    ...kept.filter((s) => !AIML.includes(s)),
  ];

  console.log('AFTER:');
  console.log('  GPA:', edu[0]?.gpa);
  console.log('  2021 entry bullets:', exp.find((e) => e.start === '2021-07')?.bullets?.length ?? 0);
  console.log('  skills count:', aiFirst.length, '(dropped:', [...DROP_SKILLS].filter((s) => skills.includes(s)).join(', ') || 'none', ')');

  db.prepare("UPDATE profile SET education = ?, experience = ?, skills = ?, updated_at = ? WHERE id = 'default'")
    .run(JSON.stringify(edu), JSON.stringify(exp), JSON.stringify(aiFirst), new Date().toISOString());

  console.log('Profile updated.');
}

main();
