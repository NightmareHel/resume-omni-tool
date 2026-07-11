import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { jobs, applications } from '@/lib/schema';
import { eq, isNull, lt, and, gte, ne } from 'drizzle-orm';

export async function GET() {
  const db = getDb();

  const [allJobs, allApps] = await Promise.all([
    db.select({
      id: jobs.id,
      fit_score: jobs.fit_score,
      sponsor_status: jobs.sponsor_status,
      scraped_at: jobs.scraped_at,
      title: jobs.title,
      company: jobs.company,
      url: jobs.url,
    }).from(jobs),
    db.select({
      id: applications.id,
      job_id: applications.job_id,
      status: applications.status,
      created_at: applications.created_at,
      applied_at: applications.applied_at,
    }).from(applications),
  ]);

  // Sponsorship breakdown
  const sponsorBreakdown: Record<string, number> = {
    confirmed: 0, likely: 0, possible: 0, unknown: 0, unlikely: 0, blocked: 0,
  };
  for (const j of allJobs) {
    const s = j.sponsor_status ?? 'unknown';
    if (s in sponsorBreakdown) sponsorBreakdown[s]++;
    else sponsorBreakdown.unknown++;
  }

  // Application funnel
  const funnel: Record<string, number> = {
    draft: 0, pending: 0, submitted: 0, replied: 0,
    screen: 0, interview: 0, offer: 0, rejected: 0, withdrawn: 0,
  };
  for (const a of allApps) {
    if (a.status in funnel) funnel[a.status]++;
  }

  // This-week applications (non-draft)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thisWeek = allApps.filter((a) => a.status !== 'draft' && a.created_at >= weekAgo).length;

  // Velocity: submissions per week (applied_at), response rate, time-to-submit
  const DAY = 24 * 60 * 60 * 1000;
  const twoWeeksAgo = new Date(Date.now() - 14 * DAY).toISOString();
  const submittedApps = allApps.filter((a) => a.applied_at);
  const submittedThisWeek = submittedApps.filter((a) => a.applied_at! >= weekAgo).length;
  const submittedLastWeek = submittedApps.filter((a) => a.applied_at! >= twoWeeksAgo && a.applied_at! < weekAgo).length;

  // 6 weekly buckets, oldest first
  const weeklySubmissions: number[] = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(Date.now() - (6 - i) * 7 * DAY).toISOString();
    const end = new Date(Date.now() - (5 - i) * 7 * DAY).toISOString();
    return submittedApps.filter((a) => a.applied_at! >= start && a.applied_at! < end).length;
  });

  const RESPONDED = new Set(['replied', 'screen', 'interview', 'offer']);
  const responded = allApps.filter((a) => RESPONDED.has(a.status)).length;
  const totalSubmitted = submittedApps.length;
  const responseRate = totalSubmitted > 0 ? Math.round((responded / totalSubmitted) * 100) : null;

  const submitLags = submittedApps
    .map((a) => (new Date(a.applied_at!).getTime() - new Date(a.created_at).getTime()) / DAY)
    .filter((d) => d >= 0);
  const avgDaysToSubmit = submitLags.length > 0
    ? Math.round((submitLags.reduce((s, d) => s + d, 0) / submitLags.length) * 10) / 10
    : null;

  // Action queue
  const manualRequired = await db
    .select({ id: applications.id, job_id: applications.job_id, status: applications.status, created_at: applications.created_at })
    .from(applications)
    .where(eq(applications.status, 'manual_required'))
    .limit(5);

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const staleDrafts = await db
    .select({ id: applications.id, job_id: applications.job_id, status: applications.status, created_at: applications.created_at })
    .from(applications)
    .where(and(eq(applications.status, 'draft'), lt(applications.created_at, twoDaysAgo)))
    .limit(5);

  const topUnscored = await db
    .select({ id: jobs.id, title: jobs.title, company: jobs.company, url: jobs.url, sponsor_status: jobs.sponsor_status, scraped_at: jobs.scraped_at })
    .from(jobs)
    .where(and(isNull(jobs.fit_score), ne(jobs.sponsor_status, 'blocked')))
    .limit(5);

  return NextResponse.json({
    totalJobs: allJobs.length,
    sponsorBreakdown,
    funnel,
    drafts: funnel.draft,
    interviews: funnel.interview,
    applicationsThisWeek: thisWeek,
    velocity: {
      submittedThisWeek,
      submittedLastWeek,
      weeklySubmissions,
      totalSubmitted,
      responseRate,
      avgDaysToSubmit,
    },
    actionQueue: { manualRequired, staleDrafts, topUnscored },
  });
}
