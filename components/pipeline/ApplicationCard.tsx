'use client';

import Link from 'next/link';

interface Application {
  id: string;
  job_id: string;
  status: string;
  resume_text: string | null;
  cover_letter: string | null;
  keyword_gap: string | null;
  notes: string | null;
  created_at: string;
  applied_at: string | null;
}

interface Job {
  id: string;
  title: string;
  company: string;
  source: string;
  url: string;
  sponsor_status?: string | null;
  sponsor_evidence?: string | null;
  sponsor_lca_count?: number | null;
}

interface Props {
  application: Application;
  job: Job | null;
  onStatusChange: (id: string, status: string, notes?: string) => void;
  onApprove: (id: string) => void;
  onRemove: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft:           'bg-zinc-700 text-zinc-300',
  pending:         'bg-amber-900 text-amber-200',
  submitted:       'bg-blue-900 text-blue-200',
  replied:         'bg-violet-900 text-violet-200',
  screen:          'bg-cyan-900 text-cyan-200',
  interview:       'bg-indigo-900 text-indigo-200',
  offer:           'bg-emerald-900 text-emerald-200',
  rejected:        'bg-red-900 text-red-300',
  withdrawn:       'bg-zinc-800 text-zinc-500',
  manual_required: 'bg-orange-900 text-orange-200',
};

const SPONSOR_BADGE: Record<string, string> = {
  confirmed: 'bg-emerald-950 text-emerald-400 ring-1 ring-emerald-800',
  likely:    'bg-emerald-950 text-emerald-500 ring-1 ring-emerald-900',
  possible:  'bg-yellow-950 text-yellow-500 ring-1 ring-yellow-900',
  unknown:   'bg-zinc-800 text-zinc-500',
  unlikely:  'bg-orange-950 text-orange-500 ring-1 ring-orange-900',
  blocked:   'bg-red-950 text-red-500 ring-1 ring-red-900',
};

function keywordScore(kwJson: string | null): number | null {
  if (!kwJson) return null;
  try { const kw = JSON.parse(kwJson); return typeof kw.score === 'number' ? kw.score : null; }
  catch { return null; }
}

export default function ApplicationCard({ application, job, onStatusChange, onRemove }: Props) {
  const kwScore = keywordScore(application.keyword_gap);
  const sponsor = job?.sponsor_status;

  return (
    <div className="bg-zinc-900 ring-1 ring-white/10 rounded-xl overflow-hidden">
      <Link
        href={`/pipeline/${application.id}`}
        className="block p-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-zinc-100 font-medium text-sm truncate leading-snug">{job?.title ?? 'Unknown Role'}</p>
            <p className="text-zinc-400 text-xs truncate">{job?.company ?? application.job_id}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[application.status] ?? STATUS_COLORS.draft}`}>
              {application.status}
            </span>
            {kwScore !== null && (
              <span className={`text-xs tabular-nums px-1.5 py-0.5 rounded ${kwScore >= 70 ? 'text-emerald-400' : kwScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                kw {kwScore}
              </span>
            )}
          </div>
        </div>
        {sponsor && sponsor !== 'unknown' && (
          <div className="mt-1.5">
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${SPONSOR_BADGE[sponsor] ?? SPONSOR_BADGE.unknown}`}
              title={job?.sponsor_evidence ?? undefined}
            >
              {sponsor === 'confirmed' || sponsor === 'likely' ? 'Sponsors' : sponsor === 'blocked' || sponsor === 'unlikely' ? 'No Sponsor' : sponsor}
              {(sponsor === 'confirmed' || sponsor === 'likely') && job?.sponsor_lca_count ? ` (${job.sponsor_lca_count})` : ''}
            </span>
          </div>
        )}
        <p className="text-zinc-600 text-xs mt-1.5">{new Date(application.created_at).toLocaleDateString()}</p>
      </Link>

      <div className="border-t border-zinc-800 px-3 py-2 flex items-center gap-2">
        {application.status === 'draft' && (
          <button
            onClick={() => onStatusChange(application.id, 'submitted')}
            className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-2.5 py-1 rounded-lg transition-colors"
            title="I submitted this by hand — move to submitted"
          >
            Mark Submitted
          </button>
        )}
        {application.resume_text && (
          <a
            href={`/api/applications/${application.id}/resume.pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Download resume PDF"
          >
            PDF
          </a>
        )}
        {job?.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Open original job posting"
          >
            Job
          </a>
        )}
        {application.status === 'draft' && (
          <button
            onClick={() => { if (confirm('Remove this draft? This cannot be undone.')) onRemove(application.id); }}
            className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
            title="Remove draft"
          >
            Remove
          </button>
        )}
        <Link
          href={`/pipeline/${application.id}`}
          className="ml-auto text-xs text-zinc-500 hover:text-emerald-400 transition-colors"
        >
          Open
        </Link>
      </div>
    </div>
  );
}
