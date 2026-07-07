'use client';

import { useState, useEffect, useCallback } from 'react';
import JobCard from './JobCard';
import { useToast } from '@/lib/toast';

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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">My Jobs</h1>
        <p className="text-zinc-400 text-sm">{jobs.length} manually added</p>
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !adding) handleAdd(); }}
          placeholder="Paste a job URL..."
          disabled={adding}
          className="flex-1 bg-zinc-800 border border-zinc-600 text-zinc-100 placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-400 disabled:opacity-50"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !url.trim()}
          className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm px-4 py-2 rounded-lg disabled:opacity-50 whitespace-nowrap"
        >
          {adding ? 'Fetching...' : 'Add Job'}
        </button>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading...</p>
      ) : jobs.length === 0 ? (
        <p className="text-zinc-500 text-sm">No manual jobs yet. Paste a URL above to add one.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <JobCard
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
  );
}
