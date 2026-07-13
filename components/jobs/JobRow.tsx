'use client';

// Dense ranked-queue row. Same data + handlers as the old JobCard, recomposed
// horizontally: score left, identity + badges center, actions right.

import { useState } from 'react';
import { SPONSOR_BADGE, SPONSOR_LABEL, JOB_STATUS_COLORS, SOURCE_LABELS, scoreText, BTN } from '@/lib/ui';

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
  selected?: boolean;
  onSelectToggle?: (id: string) => void;
}

function ScoreCircle({ score, grade }: { score: number | null; grade: string | null }) {
  if (score === null) {
    return (
      <div className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-sunken ring-1 ring-seam">
        <span className="text-faint text-[10px]">--</span>
      </div>
    );
  }
  const ring = score >= 75 ? 'ring-green-700/40' : score >= 55 ? 'ring-amber-600/40' : 'ring-red-600/40';
  return (
    <div
      className={`flex-shrink-0 flex flex-col items-center justify-center w-9 h-9 rounded-full bg-raised slab-inner ring-1 ${ring}`}
      title={grade ? `Grade ${grade}` : undefined}
    >
      <span className={`text-xs font-bold font-mono tabular-nums leading-none ${scoreText(score)}`}>{score}</span>
    </div>
  );
}

function sponsorShort(status: string, lca: number | null): string {
  if (status === 'confirmed' || status === 'likely') return `Sponsors${lca ? ` (${lca})` : ''}`;
  if (status === 'blocked' || status === 'unlikely') return 'No Sponsor';
  return SPONSOR_LABEL[status] ?? status;
}

export default function JobRow({ job, onStatusChange, onScore, onTailor, scoring, tailoring, tailoringLabel, selected, onSelectToggle }: Props) {
  const [open, setOpen] = useState(false);
  const sponsor = job.sponsor_status;

  return (
    <div className={`bg-surface border rounded-[8px] transition-colors ${selected ? 'border-bronze/60' : 'border-seam hover:border-bronze/40'}`}>
      <div className="px-3.5 py-2.5 flex items-center gap-3.5">
        {onSelectToggle && (
          <input
            type="checkbox"
            checked={!!selected}
            onChange={() => onSelectToggle(job.id)}
            className="flex-shrink-0 w-3.5 h-3.5 accent-bronze cursor-pointer"
            title="Select for batch tailor"
          />
        )}
        <ScoreCircle score={job.fit_score} grade={job.fit_grade} />

        {/* Identity + badges */}
        <div className="flex-1 min-w-0" title={job.fit_summary ?? undefined}>
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-graphite font-medium text-sm truncate">{job.title}</h3>
            <span className="hidden sm:inline text-xs font-mono bg-sunken text-stone px-1.5 py-0.5 rounded-[4px] flex-shrink-0">
              {SOURCE_LABELS[job.source] ?? job.source.toUpperCase()}
            </span>
            {sponsor && sponsor !== 'unknown' && (
              <span
                className={`hidden md:inline text-xs px-1.5 py-0.5 rounded-[4px] font-medium flex-shrink-0 ${SPONSOR_BADGE[sponsor]}`}
                title={job.sponsor_evidence ?? undefined}
              >
                {sponsorShort(sponsor, job.sponsor_lca_count)}
              </span>
            )}
            {job.entry_level === 1 && (
              <span className="hidden lg:inline text-xs bg-sunken text-stone px-1.5 py-0.5 rounded-[4px] flex-shrink-0">Entry</span>
            )}
            {job.remote === 1 && (
              <span className="hidden lg:inline text-xs bg-sunken text-stone px-1.5 py-0.5 rounded-[4px] flex-shrink-0">Remote</span>
            )}
          </div>
          <p className="text-stone text-xs truncate mt-0.5">
            {job.company}{job.location ? ` · ${job.location}` : ''}
          </p>
        </div>

        {/* Status chip */}
        <span className={`hidden sm:inline text-xs px-1.5 py-0.5 rounded-[4px] font-medium flex-shrink-0 ${JOB_STATUS_COLORS[job.status] ?? JOB_STATUS_COLORS.new}`}>
          {job.status}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <a href={job.url} target="_blank" rel="noopener noreferrer" className={`text-xs px-2 py-1 ${BTN.ghost}`}>
            View
          </a>
          <button
            onClick={() => onScore(job.id)}
            disabled={scoring}
            className={`text-xs px-2 py-1 disabled:opacity-50 ${BTN.secondary}`}
          >
            {scoring ? '...' : 'Score'}
          </button>
          <button
            onClick={() => onTailor(job.id)}
            disabled={tailoring}
            className={`text-xs px-2 py-1 disabled:opacity-50 ${BTN.primary}`}
          >
            {tailoring ? tailoringLabel ?? '...' : 'Tailor'}
          </button>
          <button onClick={() => setOpen((o) => !o)} className={`text-xs px-1.5 py-1 ${BTN.ghost}`} title="Change status">
            {open ? '×' : '⋯'}
          </button>
        </div>
      </div>

      {open && (
        <div className="flex gap-2 flex-wrap border-t border-hairline px-3.5 py-2">
          {['new', 'reviewed', 'queued', 'applied', 'archived'].map((s) => (
            <button
              key={s}
              onClick={() => { onStatusChange(job.id, s); setOpen(false); }}
              className={`text-xs px-2 py-1 rounded-[8px] ${job.status === s ? 'outline outline-1 outline-bronze' : ''} ${JOB_STATUS_COLORS[s]}`}
            >
              {s}
            </button>
          ))}
          {job.fit_summary && (
            <p className="w-full text-xs text-stone leading-relaxed pt-1">{job.fit_summary}</p>
          )}
        </div>
      )}
    </div>
  );
}
