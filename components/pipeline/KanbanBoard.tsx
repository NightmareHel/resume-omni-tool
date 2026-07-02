'use client';

import ApplicationCard from './ApplicationCard';

interface Application {
  id: string;
  job_id: string;
  status: string;
  resume_text: string | null;
  cover_letter: string | null;
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
}

interface Props {
  applications: Application[];
  jobs: Record<string, Job>;
  onStatusChange: (id: string, status: string, notes?: string) => void;
  onApprove: (id: string) => void;
}

const COLUMNS = ['draft', 'pending', 'submitted', 'replied', 'screen', 'interview', 'offer', 'rejected', 'withdrawn'];

const COLUMN_COLORS: Record<string, string> = {
  draft:     'border-zinc-600',
  pending:   'border-amber-700',
  submitted: 'border-blue-700',
  replied:   'border-violet-700',
  screen:    'border-cyan-700',
  interview: 'border-indigo-700',
  offer:     'border-emerald-600',
  rejected:  'border-red-800',
  withdrawn: 'border-zinc-700',
};

export default function KanbanBoard({ applications, jobs, onStatusChange, onApprove }: Props) {
  const byStatus: Record<string, Application[]> = {};
  for (const col of COLUMNS) byStatus[col] = [];
  for (const app of applications) {
    if (byStatus[app.status]) byStatus[app.status].push(app);
  }

  const nonEmpty = COLUMNS.filter((c) => byStatus[c].length > 0 || ['draft', 'pending', 'submitted'].includes(c));

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {nonEmpty.map((col) => (
        <div key={col} className="flex-shrink-0 w-72">
          <div className={`border-t-2 ${COLUMN_COLORS[col]} mb-3 pt-2`}>
            <h3 className="text-zinc-300 text-xs font-semibold uppercase tracking-wide">
              {col} <span className="text-zinc-500">({byStatus[col].length})</span>
            </h3>
          </div>
          <div className="flex flex-col gap-3">
            {byStatus[col].map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                job={jobs[app.job_id] ?? null}
                onStatusChange={onStatusChange}
                onApprove={onApprove}
              />
            ))}
            {byStatus[col].length === 0 && (
              <p className="text-zinc-600 text-xs">Empty</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
