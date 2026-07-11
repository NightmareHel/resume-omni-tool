/**
 * Email sync worker — polls Gmail directly (OAuth refresh token, readonly
 * scope) every 30 minutes, classifies recruiter threads with Groq, and
 * matches them to applications by company name.
 *
 * One-time setup: npx tsx scripts/gmail-auth.ts (writes GMAIL_REFRESH_TOKEN).
 * Run with: npx tsx worker/email-sync.ts
 */
import '../lib/load-env';
import cron from 'node-cron';
import { google } from 'googleapis';
import { getDb } from '../lib/db';
import { email_threads, applications, jobs } from '../lib/schema';
import { inArray } from 'drizzle-orm';
import OpenAI from 'openai';

const MODEL = 'llama-3.3-70b-versatile';

function groqClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });
}

// Recruiting-shaped Gmail query: subject terms recruiters actually use, plus
// the notification senders of the big ATSes. 3-day window — the 30-min cron
// plus PK-based dedupe makes overlap harmless.
const GMAIL_QUERY =
  'newer_than:3d (subject:(interview OR application OR applying OR opportunity OR position OR "next steps" OR offer OR recruiter) ' +
  'OR from:(greenhouse.io OR ashbyhq.com OR hire.lever.co OR myworkday.com OR smartrecruiters.com))';

function gmailClient() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) return null;
  const oauth2 = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth: oauth2 });
}

async function classifyThread(subject: string, snippet: string): Promise<{
  classification: 'reply' | 'rejection' | 'interview' | 'offer' | 'other';
  action_required: boolean;
  company: string | null;
}> {
  const client = groqClient();
  const msg = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 128,
    messages: [{
      role: 'user',
      content: `Classify this recruiter email. Return JSON only.

Subject: ${subject}
Snippet: ${snippet}

Return ONLY:
{"classification": "reply|rejection|interview|offer|other", "action_required": true|false, "company": "Company Name or null"}

Rules:
- interview: contains "interview", "chat", "call", "schedule", "meet"
- offer: contains "offer", "congratulations", "pleased to inform"
- rejection: contains "not moving forward", "other candidates", "not a fit", "position has been filled"
- reply: recruiter responded but no clear next step
- other: newsletters, automated confirmations, irrelevant`,
    }],
  });

  const content = msg.choices[0].message.content ?? '{}';
  try {
    const match = content.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { classification: 'other', action_required: false, company: null };
  } catch {
    return { classification: 'other', action_required: false, company: null };
  }
}

async function matchToApplication(company: string | null, db: ReturnType<typeof getDb>): Promise<{ applicationId: string | null; jobId: string | null }> {
  if (!company) return { applicationId: null, jobId: null };

  const allApps = await db.select({ id: applications.id, job_id: applications.job_id }).from(applications);
  if (allApps.length === 0) return { applicationId: null, jobId: null };

  const jobIds = [...new Set(allApps.map((a) => a.job_id))];
  const matchedJobs = await db.select({ id: jobs.id, company: jobs.company }).from(jobs).where(inArray(jobs.id, jobIds));
  const jobMap = new Map(matchedJobs.map((j) => [j.id, j.company]));

  const needle = company.toLowerCase();
  for (const app of allApps) {
    const co = jobMap.get(app.job_id);
    if (co && co.toLowerCase().includes(needle)) {
      return { applicationId: app.id, jobId: app.job_id };
    }
  }
  return { applicationId: null, jobId: null };
}

async function syncEmails() {
  console.log(`[email-sync] Starting at ${new Date().toISOString()}`);

  const gmail = gmailClient();
  if (!gmail) {
    console.log('[email-sync] Gmail not configured — set GMAIL_CLIENT_ID/SECRET and run: npx tsx scripts/gmail-auth.ts');
    return;
  }

  const db = getDb();
  try {
    const list = await gmail.users.threads.list({ userId: 'me', q: GMAIL_QUERY, maxResults: 50 });
    const threads = list.data.threads ?? [];
    if (threads.length === 0) { console.log('[email-sync] No matching threads'); return; }

    // PK = Gmail thread id, so dedupe is a simple existing-id check.
    const ids = threads.map((t) => t.id!).filter(Boolean);
    const existing = new Set(
      (await db.select({ id: email_threads.id }).from(email_threads).where(inArray(email_threads.id, ids))).map((r) => r.id)
    );
    const fresh = threads.filter((t) => t.id && !existing.has(t.id));
    console.log(`[email-sync] ${threads.length} threads matched, ${fresh.length} new`);

    let inserted = 0;
    for (const t of fresh) {
      try {
        const full = await gmail.users.threads.get({
          userId: 'me',
          id: t.id!,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date'],
        });
        const msg = full.data.messages?.[0];
        const headers = msg?.payload?.headers ?? [];
        const h = (name: string) => headers.find((x) => x.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
        const subject = h('Subject');
        const fromRaw = h('From'); // "Name <email>"
        const fromMatch = /^(.*?)\s*<(.+)>$/.exec(fromRaw);
        const snippet = full.data.snippet ?? msg?.snippet ?? '';
        const receivedAt = msg?.internalDate
          ? new Date(parseInt(msg.internalDate, 10)).toISOString()
          : new Date().toISOString();

        const cls = await classifyThread(subject, snippet);
        const match = await matchToApplication(cls.company, db);

        await db.insert(email_threads).values({
          id:              t.id!,
          application_id:  match.applicationId,
          job_id:          match.jobId,
          subject:         subject || '(no subject)',
          from_email:      fromMatch ? fromMatch[2] : fromRaw,
          from_name:       fromMatch ? fromMatch[1].replace(/"/g, '') : null,
          received_at:     receivedAt,
          snippet:         snippet.slice(0, 500),
          classification:  cls.classification,
          action_required: cls.action_required ? 1 : 0,
          read:            0,
        });
        inserted++;
        if (cls.classification !== 'other') {
          console.log(`[email-sync] ${cls.classification.toUpperCase()}: "${subject}" ${match.applicationId ? '→ matched application' : ''}`);
        }
      } catch (err) {
        console.error(`[email-sync] Failed thread ${t.id}:`, err instanceof Error ? err.message : err);
      }
    }
    console.log(`[email-sync] Done — ${inserted} new threads stored`);
  } catch (err) {
    console.error('[email-sync] Sync failed:', err instanceof Error ? err.message : err);
  }
}

syncEmails();
cron.schedule('*/30 * * * *', syncEmails);
console.log('[email-sync] Worker started. Gmail sync: every 30 minutes.');

export { classifyThread, matchToApplication };
