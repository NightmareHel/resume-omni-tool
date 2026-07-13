'use client';

import Link from 'next/link';
import { STATUS_COLORS, SPONSOR_BADGE, scoreText, BTN } from '@/lib/ui';

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

function keywordScore(kwJson: string | null): number | null {
  if (!kwJson) return null;
  try { const kw = JSON.parse(kwJson); return typeof kw.score === 'number' ? kw.score : null; }
  catch { return null; }
}

export default function ApplicationCard({ application, job, onStatusChange, onRemove }: Props) {
  const kwScore = keywordScore(application.keyword_gap);
  const sponsor = job?.sponsor_status;

  return (
    <div className="bg-surface border border-seam rounded-[8px] shadow-card overflow-hidden">
      <Link
        href={`/pipeline/${application.id}`}
        className="block p-3 hover:bg-sunken/50 transition-colors"
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-graphite font-medium text-sm truncate leading-snug">{job?.title ?? 'Unknown Role'}</p>
            <p className="text-stone text-xs truncate">{job?.company ?? application.job_id}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className={`text-xs px-1.5 py-0.5 rounded-[4px] font-medium ${STATUS_COLORS[application.status] ?? STATUS_COLORS.draft}`}>
              {application.status}
            </span>
            {kwScore !== null && (
              <span className={`text-xs tabular-nums px-1.5 py-0.5 rounded-[4px] ${scoreText(kwScore >= 70 ? 75 : kwScore >= 50 ? 55 : 0)}`}>
                kw {kwScore}
              </span>
            )}
          </div>
        </div>
        {sponsor && sponsor !== 'unknown' && (
          <div className="mt-1.5">
            <span
              className={`text-xs px-1.5 py-0.5 rounded-[4px] ${SPONSOR_BADGE[sponsor] ?? SPONSOR_BADGE.unknown}`}
              title={job?.sponsor_evidence ?? undefined}
            >
              {sponsor === 'confirmed' || sponsor === 'likely' ? 'Sponsors' : sponsor === 'blocked' || sponsor === 'unlikely' ? 'No Sponsor' : sponsor}
              {(sponsor === 'confirmed' || sponsor === 'likely') && job?.sponsor_lca_count ? ` (${job.sponsor_lca_count})` : ''}
            </span>
          </div>
        )}
        <p className="text-faint text-xs mt-1.5">{new Date(application.created_at).toLocaleDateString()}</p>
      </Link>

      <div className="border-t border-hairline px-3 py-2 flex items-center gap-2">
        {application.status === 'draft' && (
          <button
            onClick={() => onStatusChange(application.id, 'submitted')}
            className={`text-xs px-2.5 py-1 ${BTN.primary}`}
            title="I submitted this by hand; move to submitted"
          >
            Mark Submitted
          </button>
        )}
        {application.resume_text && (
          <a
            href={`/api/applications/${application.id}/resume.pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-xs ${BTN.ghost}`}
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
            className={`text-xs ${BTN.ghost}`}
            title="Open original job posting"
          >
            Job
          </a>
        )}
        {application.status === 'draft' && (
          <button
            onClick={() => { if (confirm('Remove this draft? This cannot be undone.')) onRemove(application.id); }}
            className="text-xs text-stone hover:text-red-700 transition-colors"
            title="Remove draft"
          >
            Remove
          </button>
        )}
        <Link
          href={`/pipeline/${application.id}`}
          className="ml-auto text-xs text-stone hover:text-bronze-strong transition-colors"
        >
          Open
        </Link>
      </div>
    </div>
  );
}
