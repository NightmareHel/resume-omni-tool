/**
 * One-off resumable backlog scorer. Run with: npx tsx scripts/score-backlog.ts
 *
 * Loops until every scoreable job has a fit_score, in the same priority order
 * as worker/score.ts (entry-level + sponsor-friendly + newest first). Safe to
 * interrupt and re-run — it only ever picks unscored rows. On Groq 429 it
 * sleeps the suggested wait and continues. Progress logged every 25 jobs.
 */
import '../lib/load-env';
import { eq } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { profile } from '../lib/schema';
import { nextUnscoredJobs, scoreAndPersist, rateLimitWaitMs } from '../lib/score-job';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const db = getDb();
  const [prof] = await db.select().from(profile).where(eq(profile.id, 'default'));
  if (!prof || !prof.full_name) {
    console.error('No profile — fill in /profile first');
    process.exit(1);
  }

  let scored = 0;
  let failed = 0;
  const started = Date.now();

  for (;;) {
    const batch = await nextUnscoredJobs(50);
    if (batch.length === 0) break;

    for (const job of batch) {
      for (;;) {
        try {
          await scoreAndPersist(job, prof);
          scored++;
          break;
        } catch (err) {
          const wait = rateLimitWaitMs(err);
          if (wait !== null) {
            console.log(`  rate limited — sleeping ${Math.round(wait / 1000)}s`);
            await sleep(wait);
            continue; // retry same job
          }
          failed++;
          console.error(`  FAILED ${job.title} @ ${job.company}: ${err instanceof Error ? err.message : err}`);
          break; // skip this job
        }
      }
      if (scored > 0 && scored % 25 === 0) {
        const mins = ((Date.now() - started) / 60000).toFixed(1);
        console.log(`[backlog] ${scored} scored, ${failed} failed, ${mins} min elapsed`);
      }
    }
  }

  console.log(`[backlog] DONE: ${scored} scored, ${failed} failed in ${((Date.now() - started) / 60000).toFixed(1)} min`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
