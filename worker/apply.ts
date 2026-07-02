/**
 * Apply worker — processes approved applications with Playwright form-fill.
 * Run with: npx tsx worker/apply.ts
 *
 * Picks up applications in 'pending' status and fills the form using
 * platform-specific strategies. Workday applications are flagged as
 * 'manual required' and skipped.
 */
import cron from 'node-cron';
import PQueue from 'p-queue';
import { chromium, type Browser } from 'playwright';
import { getDb } from '../lib/db';
import { applications, jobs } from '../lib/schema';
import { eq, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const queue = new PQueue({ concurrency: 2 });
let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: false }); // headless: false for human monitoring
  }
  return browser;
}

async function fillGreenhouse(url: string, data: {
  name: string; email: string; phone: string; resumeText: string; coverLetter: string;
}, screenshotPath: string) {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Standard Greenhouse field IDs
    await page.fill('#first_name', data.name.split(' ')[0] ?? '');
    await page.fill('#last_name', data.name.split(' ').slice(1).join(' ') || data.name);
    await page.fill('#email', data.email);
    if (data.phone) await page.fill('#phone', data.phone);

    // Resume: create temp file and upload
    const tmpPath = path.join(process.cwd(), 'data', `resume-tmp-${Date.now()}.txt`);
    fs.writeFileSync(tmpPath, data.resumeText);
    const resumeInput = await page.locator('input[type="file"]').first();
    await resumeInput.setInputFiles(tmpPath);
    fs.unlinkSync(tmpPath);

    // Cover letter if present
    const coverTextarea = page.locator('textarea[name*="cover"]').first();
    if (await coverTextarea.count() > 0 && data.coverLetter) {
      await coverTextarea.fill(data.coverLetter);
    }

    await page.screenshot({ path: screenshotPath, fullPage: true });
    await page.close();
  } catch (err) {
    await page.screenshot({ path: screenshotPath.replace('.png', '-error.png') }).catch(() => {});
    await page.close();
    throw err;
  }
}

async function processApplication(appId: string) {
  const db = getDb();
  const [app] = await db.select().from(applications).where(eq(applications.id, appId));
  if (!app || app.status !== 'pending') return;

  const [job] = await db.select().from(jobs).where(eq(jobs.id, app.job_id));
  if (!job) return;

  if (job.source === 'workday') {
    console.log(`[apply] Workday job skipped (manual required): ${job.title} at ${job.company}`);
    await db.update(applications).set({ notes: 'Workday: manual submission required', updated_at: new Date().toISOString() }).where(eq(applications.id, appId));
    return;
  }

  const screenshotDir = path.join(process.cwd(), 'data', 'screenshots');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
  const screenshotPath = path.join(screenshotDir, `${appId}-${Date.now()}.png`);

  const [profile] = await db.select().from((await import('../lib/schema')).profile);
  const name = profile?.full_name ?? 'Applicant';
  const email = profile?.email ?? '';
  const phone = profile?.phone ?? '';

  try {
    if (job.source === 'greenhouse' || job.source === 'lever' || job.source === 'ashby') {
      await fillGreenhouse(job.url, {
        name, email, phone,
        resumeText:  app.resume_text ?? '',
        coverLetter: app.cover_letter ?? '',
      }, screenshotPath);
    }

    await db.update(applications).set({
      status:            'submitted',
      applied_at:        new Date().toISOString(),
      submission_method: 'form_fill',
      screenshot_path:   screenshotPath,
      updated_at:        new Date().toISOString(),
    }).where(eq(applications.id, appId));

    console.log(`[apply] Submitted: ${job.title} at ${job.company}`);
  } catch (err) {
    console.error(`[apply] Failed: ${job.title} at ${job.company}:`, err);
    await db.update(applications).set({
      notes:      `Submission failed: ${err instanceof Error ? err.message : String(err)}`,
      updated_at: new Date().toISOString(),
    }).where(eq(applications.id, appId));
  }
}

async function pollPending() {
  const db = getDb();
  const pending = await db
    .select()
    .from(applications)
    .where(and(eq(applications.status, 'pending')));

  for (const app of pending) {
    queue.add(() => processApplication(app.id));
  }
}

// Poll for pending applications every 2 minutes
pollPending();
cron.schedule('*/2 * * * *', pollPending);
console.log('[apply] Worker started. Polling for pending applications every 2 minutes.');
