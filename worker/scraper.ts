/**
 * Background scraper worker. Run with: npx tsx worker/scraper.ts
 * Scrapes all configured targets every 6 hours.
 */
import cron from 'node-cron';
import { scrapeAll } from '../lib/scrapers/index';
import defaultConfig from '../config/scrapers.json';
import type { ScrapeConfig } from '../lib/scrapers/index';

async function runScrape() {
  console.log(`[scraper] Starting at ${new Date().toISOString()}`);
  try {
    const result = await scrapeAll(defaultConfig as ScrapeConfig);
    console.log(`[scraper] Done. runId=${result.runId} newJobs=${result.jobsNew}`);
  } catch (err) {
    console.error('[scraper] Fatal error:', err);
  }
}

// Run immediately on startup, then every 6 hours
runScrape();
cron.schedule('0 */6 * * *', runScrape);
console.log('[scraper] Worker started. Cron: every 6 hours.');
