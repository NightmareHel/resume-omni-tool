'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import MarbleBackground from '@/components/MarbleBackground';
import { SPONSOR_BADGE, STATUS_DOT, MONO_LABEL, BTN, scoreText } from '@/lib/ui';

interface DashboardData {
  totalJobs: number;
  sponsorBreakdown: Record<string, number>;
  funnel: Record<string, number>;
  drafts: number;
  interviews: number;
  applicationsThisWeek: number;
  velocity: {
    submittedThisWeek: number;
    submittedLastWeek: number;
    weeklySubmissions: number[];
    totalSubmitted: number;
    responseRate: number | null;
    avgDaysToSubmit: number | null;
  };
  actionQueue: {
    todaysTargets: Array<{ id: string; title: string; company: string; url: string; fit_score: number; fit_grade: string | null; sponsor_status: string | null }>;
    manualRequired: Array<{ id: string; job_id: string; status: string; created_at: string }>;
    staleDrafts: Array<{ id: string; job_id: string; status: string; created_at: string }>;
    awaitingReply: Array<{ id: string; applied_at: string; title: string; company: string }>;
    topUnscored: Array<{ id: string; title: string; company: string; url: string; sponsor_status: string | null; scraped_at: string }>;
  };
}

const SPONSOR_LABEL: Record<string, string> = {
  confirmed: 'Confirmed', likely: 'Likely', possible: 'Possible',
  unknown: 'Unknown', unlikely: 'Unlikely', blocked: 'Blocked',
};

const FUNNEL_ORDER = ['draft', 'pending', 'submitted', 'replied', 'screen', 'interview', 'offer'];

function StatCell({ label, value, sub, href }: { label: string; value: number | string; sub?: string; href?: string }) {
  const cell = (
    <div className="bg-sunken border border-seam p-1.5 rounded-[14px] h-full">
      <div className="bg-raised slab-inner rounded-[8px] p-4 h-full flex flex-col gap-1">
        <p className={MONO_LABEL}>{label}</p>
        <p className="text-3xl font-bold tabular-nums font-mono text-graphite">{value}</p>
        {sub && <p className="text-xs text-stone">{sub}</p>}
      </div>
    </div>
  );
  if (href) return <Link href={href} className="block hover:opacity-95 transition-opacity">{cell}</Link>;
  return cell;
}

function RailSection({ title, titleClass, count, children }: { title: string; titleClass?: string; count: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h3 className={`${MONO_LABEL} ${titleClass ?? ''}`}>{title}</h3>
        <span className="text-xs tabular-nums text-stone">{count}</span>
      </div>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sponsorLikely = (data?.sponsorBreakdown.confirmed ?? 0) + (data?.sponsorBreakdown.likely ?? 0);
  const maxFunnel = data ? Math.max(...FUNNEL_ORDER.map((s) => data.funnel[s] ?? 0), 1) : 1;

  return (
    <main className="min-h-screen relative">
      <MarbleBackground />
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8">

        {/* Two-column shell: main flow + action rail */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">

          {/* ============ MAIN COLUMN ============ */}
          <div className="flex flex-col gap-6 min-w-0">

            {/* Hero metric block */}
            <div className="bg-sunken border border-seam p-1.5 rounded-[14px]">
              <div className="bg-raised slab-inner rounded-[8px] px-7 py-6 flex flex-wrap items-end justify-between gap-6">
                <div className="flex flex-col gap-1">
                  <p className={MONO_LABEL}>Jobs in pool</p>
                  {loading ? (
                    <div className="h-14 w-40 bg-sunken rounded animate-pulse" />
                  ) : (
                    <p className="text-6xl font-bold tabular-nums font-mono tracking-tight text-bronze-strong leading-none">
                      {(data?.totalJobs ?? 0).toLocaleString()}
                    </p>
                  )}
                  <p className="text-sm text-stone mt-2">
                    {loading ? ' ' : (
                      <>
                        <span className="text-graphite font-medium tabular-nums">{sponsorLikely.toLocaleString()}</span> sponsor-friendly
                        <span className="text-faint"> · </span>
                        <span className="text-graphite font-medium tabular-nums">{data?.velocity.totalSubmitted ?? 0}</span> applications submitted
                      </>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href="/jobs" className={`text-xs px-3 py-2 ${BTN.secondary}`}>Browse Jobs</Link>
                  <Link href="/pipeline" className={`text-xs px-3 py-2 ${BTN.primary}`}>Pipeline</Link>
                </div>
              </div>
            </div>

            {/* Secondary stat cells */}
            <div className="grid grid-cols-3 gap-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-sunken border border-seam p-1.5 rounded-[14px]">
                    <div className="bg-raised slab-inner rounded-[8px] p-4">
                      <div className="h-3 w-16 bg-sunken rounded animate-pulse mb-3" />
                      <div className="h-8 w-12 bg-sunken rounded animate-pulse" />
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <StatCell label="Drafts" value={data?.drafts ?? 0} sub="awaiting review" href="/pipeline" />
                  <StatCell label="This Week" value={data?.applicationsThisWeek ?? 0} sub="applications sent" href="/pipeline" />
                  <StatCell label="Interviews" value={data?.interviews ?? 0} sub="active" href="/pipeline" />
                </>
              )}
            </div>

            {/* FLOW panel: funnel + velocity merged */}
            <div className="bg-surface border border-seam rounded-[14px] shadow-card p-5 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-graphite">Flow</h2>
                {!loading && data && (
                  <span className="text-xs text-stone">
                    {data.velocity.responseRate !== null ? `${data.velocity.responseRate}% response rate` : 'no responses yet'}
                    {data.velocity.avgDaysToSubmit !== null ? ` · ${data.velocity.avgDaysToSubmit}d to submit` : ''}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-6">
                {/* Funnel */}
                {loading ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-16 h-3 bg-sunken rounded animate-pulse" />
                        <div className="flex-1 h-4 bg-sunken rounded animate-pulse" style={{ width: `${40 + i * 10}%` }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {FUNNEL_ORDER.map((stage) => {
                      const count = data?.funnel[stage] ?? 0;
                      const pct = Math.round((count / maxFunnel) * 100);
                      return (
                        <div key={stage} className="flex items-center gap-3">
                          <span className="flex items-center gap-1.5 w-20 flex-shrink-0">
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[stage]}`} />
                            <span className="text-xs text-stone capitalize">{stage}</span>
                          </span>
                          <div className="flex-1 flex items-center gap-2">
                            <div className="flex-1 h-4 bg-sunken rounded-full overflow-hidden">
                              {count > 0 && (
                                <div className="h-full rounded-full bg-graphite/75" style={{ width: `${Math.max(pct, 4)}%` }} />
                              )}
                            </div>
                            <span className="text-xs tabular-nums text-stone w-5 text-right">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Velocity mini-chart */}
                <div className="flex flex-col gap-2">
                  <p className={MONO_LABEL}>Submissions / week</p>
                  {loading ? (
                    <div className="h-20 bg-sunken rounded animate-pulse" />
                  ) : data && (
                    <>
                      <div className="flex items-end gap-1 h-20">
                        {data.velocity.weeklySubmissions.map((n, i) => {
                          const max = Math.max(...data.velocity.weeklySubmissions, 1);
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center">
                              <div
                                className={`w-full rounded-sm ${i === 5 ? 'bg-bronze' : 'bg-sunken border border-seam'}`}
                                style={{ height: `${Math.max((n / max) * 100, n > 0 ? 8 : 3)}%` }}
                                title={`${n} submissions`}
                              />
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-stone">
                        <span className="text-graphite font-medium tabular-nums">{data.velocity.submittedThisWeek}</span> this week
                        {data.velocity.submittedLastWeek > 0 && (
                          <span className={data.velocity.submittedThisWeek >= data.velocity.submittedLastWeek ? ' text-green-700' : ' text-red-700'}>
                            {' '}({data.velocity.submittedThisWeek >= data.velocity.submittedLastWeek ? '+' : ''}{data.velocity.submittedThisWeek - data.velocity.submittedLastWeek})
                          </span>
                        )}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Sponsorship breakdown */}
            <div className="bg-surface border border-seam rounded-[14px] shadow-card p-5 flex flex-col gap-4">
              <h2 className="text-sm font-semibold text-graphite">Sponsorship Breakdown</h2>
              {loading ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-7 w-24 bg-sunken rounded-[8px] animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(SPONSOR_LABEL).map(([key, label]) => {
                    const count = data?.sponsorBreakdown[key] ?? 0;
                    return (
                      <div key={key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-medium ${SPONSOR_BADGE[key]}`}>
                        <span>{label}</span>
                        <span className="tabular-nums opacity-70">{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* ============ ACTION RAIL ============ */}
          <aside className="bg-surface border border-seam rounded-[14px] shadow-card p-4 flex flex-col gap-6 lg:sticky lg:top-[72px]">
            <h2 className="text-sm font-semibold text-graphite">Action Queue</h2>

            <RailSection title="Today's Targets" titleClass="!text-bronze-strong" count={data?.actionQueue.todaysTargets.length ?? 0}>
              {loading ? (
                <div className="h-8 bg-sunken rounded animate-pulse" />
              ) : data?.actionQueue.todaysTargets.length === 0 ? (
                <p className="text-xs text-faint">No scored jobs waiting</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data?.actionQueue.todaysTargets.map((j) => (
                    <Link key={j.id} href="/jobs" className="flex items-baseline gap-2 text-xs text-graphite hover:text-bronze-strong transition-colors">
                      <span className={`font-mono tabular-nums font-semibold flex-shrink-0 ${scoreText(j.fit_score)}`}>{Math.round(j.fit_score)}</span>
                      <span className="truncate">{j.title} at {j.company}</span>
                    </Link>
                  ))}
                </div>
              )}
            </RailSection>

            <div className="border-t border-hairline" />

            <RailSection title="Manual Required" titleClass="!text-orange-700" count={data?.actionQueue.manualRequired.length ?? 0}>
              {loading ? (
                <div className="h-8 bg-sunken rounded animate-pulse" />
              ) : data?.actionQueue.manualRequired.length === 0 ? (
                <p className="text-xs text-faint">None pending</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data?.actionQueue.manualRequired.map((a) => (
                    <Link key={a.id} href={`/pipeline/${a.id}`} className="text-xs text-graphite hover:text-bronze-strong transition-colors truncate">
                      {a.job_id.slice(0, 8)}... from {new Date(a.created_at).toLocaleDateString()}
                    </Link>
                  ))}
                </div>
              )}
            </RailSection>

            <div className="border-t border-hairline" />

            <RailSection title="Stale Drafts" titleClass="!text-amber-700" count={data?.actionQueue.staleDrafts.length ?? 0}>
              {loading ? (
                <div className="h-8 bg-sunken rounded animate-pulse" />
              ) : data?.actionQueue.staleDrafts.length === 0 ? (
                <p className="text-xs text-faint">All drafts are fresh</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data?.actionQueue.staleDrafts.map((a) => (
                    <Link key={a.id} href={`/pipeline/${a.id}`} className="text-xs text-graphite hover:text-bronze-strong transition-colors">
                      Draft from {new Date(a.created_at).toLocaleDateString()}
                    </Link>
                  ))}
                </div>
              )}
            </RailSection>

            <div className="border-t border-hairline" />

            <RailSection title="Awaiting Reply" count={data?.actionQueue.awaitingReply.length ?? 0}>
              {loading ? (
                <div className="h-8 bg-sunken rounded animate-pulse" />
              ) : data?.actionQueue.awaitingReply.length === 0 ? (
                <p className="text-xs text-faint">Nothing overdue</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data?.actionQueue.awaitingReply.map((a) => (
                    <Link key={a.id} href={`/pipeline/${a.id}`} className="flex items-baseline gap-2 text-xs text-graphite hover:text-bronze-strong transition-colors">
                      <span className="font-mono tabular-nums text-stone flex-shrink-0">
                        {Math.floor((Date.now() - new Date(a.applied_at).getTime()) / (24 * 60 * 60 * 1000))}d
                      </span>
                      <span className="truncate">{a.title} at {a.company}</span>
                    </Link>
                  ))}
                </div>
              )}
            </RailSection>

            <div className="border-t border-hairline" />

            <RailSection title="Unscored Jobs" count={data?.actionQueue.topUnscored.length ?? 0}>
              {loading ? (
                <div className="h-8 bg-sunken rounded animate-pulse" />
              ) : data?.actionQueue.topUnscored.length === 0 ? (
                <p className="text-xs text-faint">All jobs scored</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data?.actionQueue.topUnscored.map((j) => (
                    <Link key={j.id} href="/jobs" className="text-xs text-graphite hover:text-bronze-strong transition-colors truncate">
                      {j.title} at {j.company}
                    </Link>
                  ))}
                </div>
              )}
            </RailSection>

            <Link href="/pipeline" className="text-xs text-stone hover:text-graphite underline">View pipeline</Link>
          </aside>

        </div>
      </div>
    </main>
  );
}
