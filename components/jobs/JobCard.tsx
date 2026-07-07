'use client';

import { useState } from 'react';

interface Job {
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: number | null;
  url: string;
  source: string;
  status: string;
  fit_score: number | null;
  fit_grade: string | null;
  fit_summary: string | null;
  posted_at: string | null;
  sponsor_status: string | null;
  sponsor_evidence: string | null;
  sponsor_lca_count: number | null;
  entry_level: number | null;
  years_required: number | null;
}

interface Props {
  job: Job;
  onStatusChange: (id: string, status: string) => void;
  onScore: (id: string) => void;
  onTailor: (id: string) => void;
  scoring?: boolean;
  tailoring?: boolean;
  tailoringLabel?: string;
}

function ScoreBadge({ score, grade }: { score: number | null; grade: string | null }) {
  if (score === null) {
    return (
      <div className="flex-shrink-0 flex flex-col items-center justify-center w-11 h-11 rounded-full bg-zinc-800 ring-1 ring-zinc-700">
        <span className="text-zinc-600 text-xs">--</span>
      </div>
    );
  }
  const color = score >= 75 ? '#10b981' : score >= 55 ? '#f59e0b' : '#ef4444';
  const bg    = score >= 75 ? 'bg-emerald-950 ring-emerald-800' : score >= 55 ? 'bg-amber-950 ring-amber-800' : 'bg-red-950 ring-red-900';
  return (
    <div className={`flex-shrink-0 flex flex-col items-center justify-center w-11 h-11 rounded-full ring-1 ${bg}`}>
      <span className="text-sm font-bold tabular-nums leading-none" style={{ color }}>{score}</span>
      {grade && <span className="text-xs leading-none mt-0.5 font-medium" style={{ color }}>{grade}</span>}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  new:      'bg-zinc-700 text-zinc-200',
  reviewed: 'bg-blue-900 text-blue-200',
  queued:   'bg-amber-900 text-amber-200',
  applied:  'bg-emerald-900 text-emerald-200',
  archived: 'bg-zinc-800 text-zinc-500',
};

const SOURCE_LABELS: Record<string, string> = {
  greenhouse:      'GH',
  lever:           'LV',
  ashby:           'AS',
  workday:         'WD',
  custom:          'CX',
  simplify:        'SJ',
  workable:        'WK',
  themuse:         'MU',
  smartrecruiters: 'SR',
};

const SPONSOR_BADGE: Record<string, { cls: string; text: (lca: number | null) => string }> = {
  confirmed: { cls: 'bg-emerald-950 text-emerald-400 ring-1 ring-emerald-800', text: (n) => `Sponsors${n ? ` (${n} LCAs)` : ''}` },
  likely:    { cls: 'bg-emerald-950 text-emerald-500 ring-1 ring-emerald-900', text: (n) => `Likely Sponsor${n ? ` (${n})` : ''}` },
  possible:  { cls: 'bg-yellow-950 text-yellow-400 ring-1 ring-yellow-900',   text: () => 'Possible Sponsor' },
  unknown:   { cls: 'bg-zinc-800 text-zinc-500',                               text: () => 'Unknown' },
  unlikely:  { cls: 'bg-orange-950 text-orange-400 ring-1 ring-orange-900',   text: () => 'Unlikely Sponsor' },
  blocked:   { cls: 'bg-red-950 text-red-400 ring-1 ring-red-900',            text: () => 'No Sponsorship' },
};

export default function JobCard({ job, onStatusChange, onScore, onTailor, scoring, tailoring, tailoringLabel }: Props) {
  const [open, setOpen] = useState(false);
  const sponsor = job.sponsor_status ? SPONSOR_BADGE[job.sponsor_status] : null;

  return (
    <div className="bg-zinc-900 ring-1 ring-white/10 rounded-xl p-4 flex flex-col gap-3 hover:ring-white/20 transition-all">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="text-xs font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
              {SOURCE_LABELS[job.source] ?? job.source.toUpperCase()}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[job.status] ?? STATUS_COLORS.new}`}>
              {job.status}
            </span>
            {job.remote === 1 && (
              <span className="text-xs bg-violet-950 text-violet-400 ring-1 ring-violet-800 px-1.5 py-0.5 rounded">Remote</span>
            )}
            {job.entry_level === 1 && (
              <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">Entry</span>
            )}
            {job.years_required !== null && job.years_required > 0 && (
              <span className="text-xs bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded tabular-nums">{job.years_required}yr+</span>
            )}
          </div>
          <h3 className="text-zinc-100 font-semibold text-sm leading-snug">{job.title}</h3>
          <p className="text-zinc-400 text-xs mt-0.5">{job.company}{job.location ? ` · ${job.location}` : ''}</p>
        </div>
        <ScoreBadge score={job.fit_score} grade={job.fit_grade} />
      </div>

      {sponsor && (
        <span
          className={`self-start text-xs px-2 py-0.5 rounded font-medium ${sponsor.cls}`}
          title={job.sponsor_evidence ?? undefined}
        >
          {sponsor.text(job.sponsor_lca_count)}
        </span>
      )}

      {job.fit_summary && (
        <div className="border border-zinc-800 rounded-lg px-3 py-2 bg-zinc-950/50">
          <p className="text-zinc-400 text-xs leading-relaxed">{job.fit_summary}</p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-500 hover:text-zinc-200 underline transition-colors">
          View Job
        </a>
        <button
          onClick={() => onScore(job.id)}
          disabled={scoring}
          className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded-lg disabled:opacity-50 transition-colors"
        >
          {scoring ? 'Scoring...' : 'Score'}
        </button>
        <button
          onClick={() => onTailor(job.id)}
          disabled={tailoring}
          className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-2 py-1 rounded-lg disabled:opacity-50 transition-colors"
        >
          {tailoring ? tailoringLabel ?? 'Tailoring...' : 'Tailor'}
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded-lg transition-colors"
        >
          {open ? 'Less' : 'Status'}
        </button>
      </div>

      {open && (
        <div className="flex gap-2 flex-wrap border-t border-zinc-800 pt-2">
          {['new', 'reviewed', 'queued', 'applied', 'archived'].map((s) => (
            <button
              key={s}
              onClick={() => { onStatusChange(job.id, s); setOpen(false); }}
              className={`text-xs px-2 py-1 rounded-lg ${job.status === s ? 'ring-1 ring-zinc-400' : ''} ${STATUS_COLORS[s]}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
