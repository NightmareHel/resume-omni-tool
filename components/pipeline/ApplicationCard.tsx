'use client';

import { useState } from 'react';
import { TRANSITIONS } from '@/lib/application-state';

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
  application: Application;
  job: Job | null;
  onStatusChange: (id: string, status: string, notes?: string) => void;
  onApprove: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-zinc-700 text-zinc-300',
  pending:   'bg-amber-900 text-amber-200',
  submitted: 'bg-blue-900 text-blue-200',
  replied:   'bg-violet-900 text-violet-200',
  screen:    'bg-cyan-900 text-cyan-200',
  interview: 'bg-indigo-900 text-indigo-200',
  offer:     'bg-emerald-900 text-emerald-200',
  rejected:  'bg-red-900 text-red-300',
  withdrawn: 'bg-zinc-800 text-zinc-500',
};

export default function ApplicationCard({ application, job, onStatusChange, onApprove }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(application.notes ?? '');
  const [editingNotes, setEditingNotes] = useState(false);

  const allowed = TRANSITIONS[application.status] ?? [];

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-zinc-100 font-semibold text-sm truncate">{job?.title ?? 'Unknown Role'}</p>
          <p className="text-zinc-400 text-xs">{job?.company ?? application.job_id}</p>
          <p className="text-zinc-500 text-xs">{new Date(application.created_at).toLocaleDateString()}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${STATUS_COLORS[application.status] ?? STATUS_COLORS.draft}`}>
          {application.status}
        </span>
      </div>

      {application.status === 'draft' && (
        <button
          onClick={() => onApprove(application.id)}
          className="w-full text-sm bg-emerald-700 hover:bg-emerald-600 text-white py-1.5 rounded-lg"
        >
          Approve & Queue
        </button>
      )}

      {allowed.length > 0 && application.status !== 'draft' && (
        <div className="flex flex-wrap gap-1.5">
          {allowed.map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(application.id, s)}
              className={`text-xs px-2 py-1 rounded ${STATUS_COLORS[s]}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {job?.url && (
          <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-zinc-100 underline">
            View Job
          </a>
        )}
        {application.resume_text && (
          <button onClick={() => setExpanded((e) => !e)} className="text-xs text-zinc-400 hover:text-zinc-100 underline">
            {expanded ? 'Hide Resume' : 'Show Resume'}
          </button>
        )}
        <button onClick={() => setEditingNotes((e) => !e)} className="text-xs text-zinc-400 hover:text-zinc-100 underline">
          Notes
        </button>
      </div>

      {editingNotes && (
        <div className="flex flex-col gap-2">
          <textarea
            className="bg-zinc-700 border border-zinc-600 text-zinc-100 rounded px-2 py-1 text-xs min-h-16 resize-y placeholder-zinc-500"
            placeholder="Notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button
            onClick={() => { onStatusChange(application.id, application.status, notes); setEditingNotes(false); }}
            className="self-end text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-2 py-1 rounded"
          >
            Save Notes
          </button>
        </div>
      )}

      {expanded && application.resume_text && (
        <pre className="bg-zinc-900 border border-zinc-700 rounded p-3 text-xs text-zinc-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
          {application.resume_text}
        </pre>
      )}
    </div>
  );
}
