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
      <div className="flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-full bg-zinc-700 border border-zinc-600">
        <span className="text-zinc-500 text-xs">--</span>
      </div>
    );
  }
  const color = score >= 75 ? '#10b981' : score >= 55 ? '#f59e0b' : '#ef4444';
  const bg    = score >= 75 ? 'bg-emerald-950 border-emerald-800' : score >= 55 ? 'bg-amber-950 border-amber-800' : 'bg-red-950 border-red-900';
  return (
    <div className={`flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-full border ${bg}`}>
      <span className="text-sm font-bold leading-none" style={{ color }}>{score}</span>
      {grade && <span className="text-xs leading-none mt-0.5" style={{ color }}>{grade}</span>}
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
  greenhouse: 'GH',
  lever:      'LV',
  ashby:      'AS',
  workday:    'WD',
  custom:     'CX',
};

export default function JobCard({ job, onStatusChange, onScore, onTailor, scoring, tailoring, tailoringLabel }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-mono bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">
              {SOURCE_LABELS[job.source] ?? job.source.toUpperCase()}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[job.status] ?? STATUS_COLORS.new}`}>
              {job.status}
            </span>
            {job.remote === 1 && (
              <span className="text-xs bg-violet-900 text-violet-200 px-1.5 py-0.5 rounded">Remote</span>
            )}
          </div>
          <h3 className="text-zinc-100 font-semibold text-sm leading-snug">{job.title}</h3>
          <p className="text-zinc-400 text-xs mt-0.5">{job.company}{job.location ? ` · ${job.location}` : ''}</p>
        </div>

        <ScoreBadge score={job.fit_score} grade={job.fit_grade} />
      </div>

      {job.fit_summary && (
        <div className="border border-zinc-700 rounded-lg px-3 py-2 bg-zinc-900">
          <p className="text-zinc-300 text-xs leading-relaxed">{job.fit_summary}</p>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-zinc-400 hover:text-zinc-100 underline"
        >
          View Job
        </a>
        <button
          onClick={() => onScore(job.id)}
          disabled={scoring}
          className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-2 py-1 rounded disabled:opacity-50"
        >
          {scoring ? 'Scoring...' : 'Score'}
        </button>
        <button
          onClick={() => onTailor(job.id)}
          disabled={tailoring}
          className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-2 py-1 rounded disabled:opacity-50"
        >
          {tailoring ? tailoringLabel ?? 'Tailoring...' : 'Tailor'}
        </button>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-2 py-1 rounded"
        >
          {open ? 'Less' : 'Status'}
        </button>
      </div>

      {open && (
        <div className="flex gap-2 flex-wrap border-t border-zinc-700 pt-2">
          {['new', 'reviewed', 'queued', 'applied', 'archived'].map((s) => (
            <button
              key={s}
              onClick={() => { onStatusChange(job.id, s); setOpen(false); }}
              className={`text-xs px-2 py-1 rounded ${job.status === s ? 'ring-1 ring-zinc-400' : ''} ${STATUS_COLORS[s]}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
