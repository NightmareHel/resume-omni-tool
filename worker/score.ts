/**
 * Background scoring worker. Run with: npx tsx worker/score.ts
 * Every 10 minutes, scores the next batch of unscored jobs in priority order
 * (entry-level + sponsor-friendly + newest first). Serial calls sized for the
 * Groq free tier; a 429 ends the cycle early and the next cron picks it up.
 */
import '../lib/load-env';
import cron from 'node-cron';
import { eq } from 'drizzle-orm';
import { getDb } from '../lib/db';
import { profile } from '../lib/schema';
import { nextUnscoredJobs, scoreAndPersist, rateLimitWaitMs } from '../lib/score-job';

const BATCH_SIZE = 15;
let running = false;

async function runCycle() {
  if (running) return; // don't stack cycles if a batch outlives the interval
  running = true;
  try {
    const db = getDb();
    const [prof] = await db.select().from(profile).where(eq(profile.id, 'default'));
    if (!prof || !prof.full_name) {
      console.log('[score] No profile — skipping cycle');
      return;
    }

    const batch = await nextUnscoredJobs(BATCH_SIZE);
    if (batch.length === 0) {
      console.log('[score] Backlog clear — nothing to score');
      return;
    }

    let done = 0;
    for (const job of batch) {
      try {
        const r = await scoreAndPersist(job, prof);
        done++;
        console.log(`[score] ${r.score} ${r.grade} — ${job.title} @ ${job.company}`);
      } catch (err) {
        const wait = rateLimitWaitMs(err);
        if (wait !== null) {
          console.log(`[score] Rate limited — ending cycle (${done}/${batch.length} done), retry next cron`);
          return;
        }
        console.error(`[score] Failed ${job.id} (${job.title} @ ${job.company}):`, err instanceof Error ? err.message : err);
      }
    }
    console.log(`[score] Cycle complete: ${done}/${batch.length} scored`);
  } finally {
    running = false;
  }
}

// Run immediately on startup, then every 10 minutes
runCycle();
cron.schedule('*/10 * * * *', runCycle);
console.log('[score] Worker started. Cron: every 10 minutes.');
