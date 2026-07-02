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
import os from 'os';
import path from 'path';
import { generateResumePDF } from '../lib/resume-pdf';

class ManualRequiredError extends Error {
  constructor(reason: string) { super(reason); this.name = 'ManualRequiredError'; }
}

const queue = new PQueue({ concurrency: 2 });
let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: false }); // headless: false for human monitoring
  }
  return browser;
}

interface FillData {
  name: string;
  email: string;
  phone: string;
  linkedin: string;
  resumePath: string;
  coverLetter: string;
}

async function fillGreenhouse(url: string, data: FillData, screenshotPath: string) {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    await page.fill('#first_name', data.name.split(' ')[0] ?? '');
    await page.fill('#last_name', data.name.split(' ').slice(1).join(' ') || data.name);
    await page.fill('#email', data.email);
    if (data.phone) await page.fill('#phone', data.phone);

    const resumeInput = page.locator('input[type="file"]').first();
    await resumeInput.setInputFiles(data.resumePath);

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

async function fillLever(url: string, data: FillData, screenshotPath: string) {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const frame = page.frameLocator('iframe').first();

    // Detect custom questions before filling: count visible text-like inputs,
    // then subtract the ones we know how to handle. Any remainder = custom.
    const allTextInputs = frame.locator('input[type="text"], input[type="number"], textarea, select');
    const totalCount = await allTextInputs.count();
    const standardCount = await frame.locator([
      'input[autocomplete="name"]',
      'input[aria-label*="name" i]',
      'input[name*="name" i]',
      'input[aria-label*="linkedin" i]',
      'input[placeholder*="linkedin" i]',
      'textarea[aria-label*="cover" i]',
      'textarea[name*="cover" i]',
    ].join(', ')).count();

    if (totalCount > standardCount) {
      await page.screenshot({ path: screenshotPath.replace('.png', '-manual.png') }).catch(() => {});
      await page.close();
      throw new ManualRequiredError(`Lever: ${totalCount - standardCount} unrecognized input(s) at ${url}`);
    }

    await frame.locator('input[autocomplete="name"], input[aria-label*="name" i], input[name*="name" i]').first().fill(data.name);
    await frame.locator('input[type="email"], input[aria-label*="email" i]').first().fill(data.email);
    await frame.locator('input[type="tel"], input[aria-label*="phone" i]').first().fill(data.phone);
    if (data.linkedin) {
      const liBox = frame.locator('input[aria-label*="linkedin" i], input[placeholder*="linkedin" i]');
      if (await liBox.count() > 0) await liBox.first().fill(data.linkedin);
    }
    await frame.locator('input[type="file"]').first().setInputFiles(data.resumePath);
    if (data.coverLetter) {
      const clBox = frame.locator('textarea[aria-label*="cover" i], textarea[name*="cover" i]');
      if (await clBox.count() > 0) await clBox.first().fill(data.coverLetter);
    }

    await page.screenshot({ path: screenshotPath, fullPage: true });
    await page.close();
  } catch (err) {
    if (!(err instanceof ManualRequiredError)) {
      await page.screenshot({ path: screenshotPath.replace('.png', '-error.png') }).catch(() => {});
      await page.close();
    }
    throw err;
  }
}

async function fillAshby(url: string, data: FillData, screenshotPath: string) {
  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Detect custom questions: same pattern — count vs known standard selectors
    const allTextInputs = page.locator('input[type="text"], input[type="number"], textarea, select');
    const totalCount = await allTextInputs.count();
    const standardCount = await page.locator([
      'input[name="_systemfield_name"]',
      'input[name="_systemfield_email"]',
      'input[name="_systemfield_phone"]',
      'input[aria-label*="name" i]',
      'textarea[aria-label*="cover" i]',
      'textarea[placeholder*="cover" i]',
    ].join(', ')).count();

    if (totalCount > standardCount) {
      await page.screenshot({ path: screenshotPath.replace('.png', '-manual.png') }).catch(() => {});
      await page.close();
      throw new ManualRequiredError(`Ashby: ${totalCount - standardCount} unrecognized input(s) at ${url}`);
    }

    await page.locator('input[name="_systemfield_name"], input[aria-label*="name" i]').first().fill(data.name);
    await page.locator('input[name="_systemfield_email"], input[type="email"]').first().fill(data.email);
    await page.locator('input[name="_systemfield_phone"], input[type="tel"]').first().fill(data.phone);
    await page.locator('input[type="file"]').first().setInputFiles(data.resumePath);
    if (data.coverLetter) {
      const clBox = page.locator('textarea[aria-label*="cover" i], textarea[placeholder*="cover" i]');
      if (await clBox.count() > 0) await clBox.first().fill(data.coverLetter);
    }

    await page.screenshot({ path: screenshotPath, fullPage: true });
    await page.close();
  } catch (err) {
    if (!(err instanceof ManualRequiredError)) {
      await page.screenshot({ path: screenshotPath.replace('.png', '-error.png') }).catch(() => {});
      await page.close();
    }
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
  if (!profile) {
    console.log(`[apply] No profile found, skipping ${appId}`);
    return;
  }
  if (!app.resume_text) {
    console.log(`[apply] No resume text on ${appId}, skipping`);
    return;
  }

  const fillData: FillData = {
    name:        profile.full_name ?? 'Applicant',
    email:       profile.email ?? '',
    phone:       profile.phone ?? '',
    linkedin:    profile.linkedin_url ?? '',
    resumePath:  '',
    coverLetter: app.cover_letter ?? '',
  };

  let tmpPath: string | null = null;
  try {
    const pdfBuffer = await generateResumePDF(app.resume_text, profile);
    tmpPath = path.join(os.tmpdir(), `resume-${Date.now()}.pdf`);
    fs.writeFileSync(tmpPath, pdfBuffer);
    fillData.resumePath = tmpPath;

    if (job.source === 'greenhouse') {
      await fillGreenhouse(job.url, fillData, screenshotPath);
    } else if (job.source === 'lever') {
      await fillLever(job.url, fillData, screenshotPath);
    } else if (job.source === 'ashby') {
      await fillAshby(job.url, fillData, screenshotPath);
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
    if (err instanceof ManualRequiredError) {
      console.log(`[apply] Manual required: ${job.title} at ${job.company} — ${err.message}`);
      await db.update(applications).set({
        status:     'manual_required',
        notes:      err.message,
        updated_at: new Date().toISOString(),
      }).where(eq(applications.id, appId));
    } else {
      console.error(`[apply] Failed: ${job.title} at ${job.company}:`, err);
      await db.update(applications).set({
        notes:      `Submission failed: ${err instanceof Error ? err.message : String(err)}`,
        updated_at: new Date().toISOString(),
      }).where(eq(applications.id, appId));
    }
  } finally {
    if (tmpPath) try { fs.unlinkSync(tmpPath); } catch {}
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
