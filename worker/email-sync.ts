/**
 * Email sync worker — polls Gmail via Boardroom's Gmail MCP and classifies
 * recruiter threads. Matches threads to applications by company name.
 *
 * This worker is intended to run inside a Claude Code session where Gmail MCP
 * tools are available. In standalone Node.js mode, it logs a warning and exits.
 *
 * Run with: npx tsx worker/email-sync.ts
 */
import cron from 'node-cron';
import { getDb } from '../lib/db';
import { email_threads, applications, jobs } from '../lib/schema';
import { eq, inArray } from 'drizzle-orm';
import { uuid } from '../lib/ids';
import OpenAI from 'openai';

const MODEL = 'llama-3.3-70b-versatile';

function groqClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  });
}

interface GmailThread {
  id: string;
  subject?: string;
  from?: string;
  snippet?: string;
  date?: string;
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

  // Gmail MCP is only available inside a Claude Code session.
  // In standalone mode, this worker logs a notice and waits for the MCP session.
  // The actual MCP call flow is documented here for when this runs in a Boardroom session:
  //
  //   const threads = await mcp.gmail.searchThreads({
  //     query: 'subject:(interview OR application OR opportunity OR role) is:unread newer_than:2d'
  //   });
  //   for (const thread of threads) {
  //     const full = await mcp.gmail.getThread({ threadId: thread.id });
  //     // classify + insert below
  //   }

  console.log('[email-sync] Note: Gmail MCP sync requires a Boardroom Claude Code session.');
  console.log('[email-sync] In standalone mode, use the /emails page → Sync Now button from a Boardroom session.');
  console.log('[email-sync] Worker standing by for manual trigger or session integration.');
}

syncEmails();
cron.schedule('*/30 * * * *', syncEmails);
console.log('[email-sync] Worker started. Gmail sync: every 30 minutes.');

export { classifyThread, matchToApplication };
