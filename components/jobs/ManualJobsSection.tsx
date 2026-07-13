'use client';

import { useState, useEffect, useCallback } from 'react';
import JobRow from './JobRow';
import { useToast } from '@/lib/toast';
import { MONO_LABEL } from '@/lib/ui';

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
  onTailor?: (jobId: string, onProgress?: (label: string) => void) => void | Promise<void>;
}

export default function ManualJobsSection({ onTailor }: Props) {
  const { addToast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [tailoringId, setTailoringId] = useState<string | null>(null);
  const [tailorLabel, setTailorLabel] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/jobs?source=custom&limit=100');
    const data = await res.json();
    setJobs(data.jobs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const handleAdd = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      const res = await fetch('/api/jobs/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      if (res.status === 409) {
        addToast('Already added', 'info');
      } else if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addToast((data as { error?: string }).error ?? `Failed to add job (${res.status})`, 'error');
      } else {
        const { job } = await res.json();
        setJobs((prev) => [job, ...prev]);
        setUrl('');
        addToast('Job added', 'success');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setJobs((prev) => prev.map((j) => j.id === id ? { ...j, status } : j));
  };

  const handleScore = async (id: string) => {
    setScoringId(id);
    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: id }),
    });
    if (res.ok) {
      const { score, grade, summary } = await res.json();
      setJobs((prev) => prev.map((j) => j.id === id ? { ...j, fit_score: score, fit_grade: grade, fit_summary: summary } : j));
    } else {
      const data = await res.json().catch(() => ({}));
      addToast((data as { error?: string }).error ?? `Scoring failed (${res.status})`, 'error');
    }
    setScoringId(null);
  };

  const handleTailorInternal = async (id: string) => {
    if (!onTailor) return;
    setTailoringId(id);
    setTailorLabel(null);
    await onTailor(id, setTailorLabel);
    setTailoringId(null);
    setTailorLabel(null);
  };

  return (
    <div className="bg-surface border border-seam rounded-[14px] shadow-card">
      {/* Slim strip header: label + inline add form on one line */}
      <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 flex-shrink-0"
          title={open ? 'Collapse' : 'Expand'}
        >
          <span className={`text-faint transition-transform text-xs ${open ? 'rotate-90' : ''}`}>▶</span>
          <span className={MONO_LABEL}>My Jobs</span>
          <span className="text-xs tabular-nums text-stone">({jobs.length})</span>
        </button>
        <div className="flex gap-2 flex-1 min-w-64">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !adding) handleAdd(); }}
            placeholder="Paste a job URL to import..."
            disabled={adding}
            className="flex-1 bg-quartz border border-seam text-graphite placeholder-faint rounded-[8px] px-3 py-1.5 text-sm focus:outline-none focus:border-bronze disabled:opacity-50"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !url.trim()}
            className="bg-graphite text-white hover:bg-black active:scale-[0.98] rounded-[8px] transition-all text-xs px-3.5 py-1.5 disabled:opacity-50 whitespace-nowrap"
          >
            {adding ? 'Fetching...' : 'Add Job'}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-hairline px-3 py-3">
          {loading ? (
            <p className="text-stone text-sm px-1">Loading...</p>
          ) : jobs.length === 0 ? (
            <p className="text-faint text-xs px-1">No manual jobs yet. Paste a URL above to add one.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {jobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onStatusChange={handleStatusChange}
                  onScore={handleScore}
                  onTailor={onTailor ? () => handleTailorInternal(job.id) : () => {}}
                  scoring={scoringId === job.id}
                  tailoring={tailoringId === job.id}
                  tailoringLabel={tailoringId === job.id ? tailorLabel ?? undefined : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
