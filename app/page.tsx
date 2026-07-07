'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DashboardData {
  totalJobs: number;
  sponsorBreakdown: Record<string, number>;
  funnel: Record<string, number>;
  drafts: number;
  interviews: number;
  applicationsThisWeek: number;
  actionQueue: {
    manualRequired: Array<{ id: string; job_id: string; status: string; created_at: string }>;
    staleDrafts: Array<{ id: string; job_id: string; status: string; created_at: string }>;
    topUnscored: Array<{ id: string; title: string; company: string; url: string; sponsor_status: string | null; scraped_at: string }>;
  };
}

const SPONSOR_CHIP: Record<string, string> = {
  confirmed: 'bg-emerald-950 text-emerald-400 ring-1 ring-emerald-800',
  likely:    'bg-emerald-950 text-emerald-500 ring-1 ring-emerald-900',
  possible:  'bg-yellow-950 text-yellow-400 ring-1 ring-yellow-800',
  unknown:   'bg-zinc-800 text-zinc-400',
  unlikely:  'bg-orange-950 text-orange-400 ring-1 ring-orange-800',
  blocked:   'bg-red-950 text-red-400 ring-1 ring-red-800',
};

const SPONSOR_LABEL: Record<string, string> = {
  confirmed: 'Confirmed', likely: 'Likely', possible: 'Possible',
  unknown: 'Unknown', unlikely: 'Unlikely', blocked: 'Blocked',
};

const FUNNEL_ORDER = ['draft', 'pending', 'submitted', 'replied', 'screen', 'interview', 'offer'];
const FUNNEL_COLORS: Record<string, string> = {
  draft: 'bg-zinc-700', pending: 'bg-amber-700', submitted: 'bg-blue-700',
  replied: 'bg-violet-700', screen: 'bg-cyan-700', interview: 'bg-indigo-600', offer: 'bg-emerald-600',
};

function StatCard({ label, value, sub, href }: { label: string; value: number | string; sub?: string; href?: string }) {
  const inner = (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
      <p className="text-3xl font-bold tabular-nums text-zinc-100">{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  );
  const card = (
    <div className="bg-white/5 ring-1 ring-white/10 p-1.5 rounded-xl">
      <div className="bg-zinc-900/80 ring-1 ring-white/5 rounded-lg p-4 h-full">
        {inner}
      </div>
    </div>
  );
  if (href) return <Link href={href} className="block hover:ring-white/20 transition-all rounded-xl">{card}</Link>;
  return card;
}

function SkeletonStat() {
  return (
    <div className="bg-white/5 ring-1 ring-white/10 p-1.5 rounded-xl">
      <div className="bg-zinc-900/80 ring-1 ring-white/5 rounded-lg p-4">
        <div className="h-3 w-16 bg-zinc-800 rounded animate-pulse mb-3" />
        <div className="h-8 w-12 bg-zinc-800 rounded animate-pulse" />
      </div>
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
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Dashboard</h1>
            <p className="text-zinc-500 text-sm mt-0.5">JobPilot command center</p>
          </div>
          <div className="flex gap-2">
            <Link href="/jobs" className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-2 rounded-lg transition-colors">
              Browse Jobs
            </Link>
            <Link href="/pipeline" className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg transition-colors">
              Pipeline
            </Link>
          </div>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonStat key={i} />)
          ) : (
            <>
              <StatCard label="Total Jobs" value={data?.totalJobs ?? 0} href="/jobs" />
              <StatCard label="Likely Sponsors" value={sponsorLikely} sub="confirmed + likely" href="/jobs" />
              <StatCard label="Drafts" value={data?.drafts ?? 0} sub="awaiting review" href="/pipeline" />
              <StatCard label="This Week" value={data?.applicationsThisWeek ?? 0} sub="applications sent" href="/pipeline" />
              <StatCard label="Interviews" value={data?.interviews ?? 0} sub="active" href="/pipeline" />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pipeline funnel */}
          <div className="bg-zinc-900 ring-1 ring-white/10 rounded-xl p-5 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-zinc-300">Pipeline Funnel</h2>
            {loading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-16 h-3 bg-zinc-800 rounded animate-pulse" />
                    <div className="flex-1 h-5 bg-zinc-800 rounded animate-pulse" style={{ width: `${40 + i * 10}%` }} />
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
                      <span className="text-xs text-zinc-500 w-16 capitalize">{stage}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 h-4 bg-zinc-800 rounded-full overflow-hidden">
                          {count > 0 && (
                            <div
                              className={`h-full rounded-full ${FUNNEL_COLORS[stage]}`}
                              style={{ width: `${Math.max(pct, 4)}%` }}
                            />
                          )}
                        </div>
                        <span className="text-xs tabular-nums text-zinc-400 w-5 text-right">{count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sponsorship breakdown */}
          <div className="bg-zinc-900 ring-1 ring-white/10 rounded-xl p-5 flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-zinc-300">Sponsorship Breakdown</h2>
            {loading ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-7 w-24 bg-zinc-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(SPONSOR_LABEL).map(([key, label]) => {
                  const count = data?.sponsorBreakdown[key] ?? 0;
                  return (
                    <div key={key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${SPONSOR_CHIP[key]}`}>
                      <span>{label}</span>
                      <span className="tabular-nums opacity-70">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-zinc-600 mt-auto">Across {data?.totalJobs ?? '...'} scraped jobs</p>
          </div>
        </div>

        {/* Action queue */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-zinc-300">Action Queue</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Manual required */}
            <div className="bg-zinc-900 ring-1 ring-white/10 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-orange-400 uppercase tracking-wide">Manual Required</h3>
                <span className="text-xs tabular-nums text-zinc-500">{data?.actionQueue.manualRequired.length ?? 0}</span>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-8 bg-zinc-800 rounded animate-pulse" />)}
                </div>
              ) : data?.actionQueue.manualRequired.length === 0 ? (
                <p className="text-xs text-zinc-600">None pending</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data?.actionQueue.manualRequired.map((a) => (
                    <Link key={a.id} href={`/pipeline/${a.id}`} className="text-xs text-zinc-300 hover:text-emerald-400 transition-colors truncate">
                      {a.job_id.slice(0, 8)}... from {new Date(a.created_at).toLocaleDateString()}
                    </Link>
                  ))}
                  <Link href="/pipeline" className="text-xs text-zinc-500 hover:text-zinc-300 underline mt-1">View all</Link>
                </div>
              )}
            </div>

            {/* Stale drafts */}
            <div className="bg-zinc-900 ring-1 ring-white/10 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Stale Drafts</h3>
                <span className="text-xs tabular-nums text-zinc-500">{data?.actionQueue.staleDrafts.length ?? 0}</span>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-8 bg-zinc-800 rounded animate-pulse" />)}
                </div>
              ) : data?.actionQueue.staleDrafts.length === 0 ? (
                <p className="text-xs text-zinc-600">All drafts are fresh</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data?.actionQueue.staleDrafts.map((a) => (
                    <Link key={a.id} href={`/pipeline/${a.id}`} className="text-xs text-zinc-300 hover:text-emerald-400 transition-colors">
                      Draft from {new Date(a.created_at).toLocaleDateString()}
                    </Link>
                  ))}
                  <Link href="/pipeline" className="text-xs text-zinc-500 hover:text-zinc-300 underline mt-1">View pipeline</Link>
                </div>
              )}
            </div>

            {/* Top unscored */}
            <div className="bg-zinc-900 ring-1 ring-white/10 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Unscored Jobs</h3>
                <span className="text-xs tabular-nums text-zinc-500">{data?.actionQueue.topUnscored.length ?? 0}</span>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 bg-zinc-800 rounded animate-pulse" />)}
                </div>
              ) : data?.actionQueue.topUnscored.length === 0 ? (
                <p className="text-xs text-zinc-600">All jobs scored</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data?.actionQueue.topUnscored.map((j) => (
                    <div key={j.id} className="flex items-center gap-2">
                      <Link href="/jobs" className="text-xs text-zinc-300 hover:text-emerald-400 transition-colors truncate flex-1">
                        {j.title} at {j.company}
                      </Link>
                    </div>
                  ))}
                  <Link href="/jobs" className="text-xs text-zinc-500 hover:text-zinc-300 underline mt-1">Score on Jobs page</Link>
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}
