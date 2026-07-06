// One-off: classify sponsorship + seniority for all existing jobs.
// Safe to re-run; overwrites the classification columns every time.
//
//   npx tsx scripts/backfill-classify.ts

import { eq } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { jobs } from '../lib/schema';
import { classifyJob } from '../lib/classify-job';

async function main() {
  const db = getDb();
  const all = await db.select().from(jobs);
  console.log(`Classifying ${all.length} jobs...`);

  const counts: Record<string, number> = {};
  let done = 0;
  for (const job of all) {
    const cls = await classifyJob(job.title, job.company, job.description);
    await db.update(jobs).set({
      sponsor_status:    cls.sponsor_status,
      sponsor_evidence:  cls.sponsor_evidence,
      sponsor_lca_count: cls.sponsor_lca_count,
      years_required:    cls.years_required,
      entry_level:       cls.entry_level,
      everify:           cls.everify,
    }).where(eq(jobs.id, job.id));

    counts[cls.sponsor_status] = (counts[cls.sponsor_status] ?? 0) + 1;
    if (++done % 100 === 0) console.log(`  ${done}/${all.length}`);
  }

  console.log('Sponsor status breakdown:', counts);
  const entry = all.length ? await db.select().from(jobs).then((r) => r.filter((j) => j.entry_level === 1).length) : 0;
  console.log(`Entry-level: ${entry}/${all.length}`);
}

main();
