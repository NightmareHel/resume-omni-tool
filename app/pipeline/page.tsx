'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import KanbanBoard from '@/components/pipeline/KanbanBoard';
import { useToast } from '@/lib/toast';


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

interface Job { id: string; title: string; company: string; source: string; url: string }

export default function PipelinePage() {
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const [apps, setApps] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appsRes, jobsRes] = await Promise.all([
        fetch('/api/applications').then((r) => r.json()),
        fetch('/api/jobs?limit=200').then((r) => r.json()),
      ]);
      setApps(appsRes.applications ?? []);
      const jobMap: Record<string, Job> = {};
      for (const j of jobsRes.jobs ?? []) jobMap[j.id] = j;
      setJobs(jobMap);
    } catch {
      setError('Failed to load pipeline. Refresh to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get('tailored') === 'true') {
      addToast('New draft ready for review', 'success');
    }
  }, [searchParams, addToast]);

  const handleStatusChange = async (id: string, status: string, notes?: string) => {
    const body: Record<string, string> = { status };
    if (notes !== undefined) body.notes = notes;

    const res = await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const { application } = await res.json();
      setApps((prev) => prev.map((a) => a.id === id ? application : a));
    } else {
      const { error: err } = await res.json().catch(() => ({}));
      addToast((err as string) ?? 'Status update failed', 'error');
    }
  };

  const handleApprove = async (id: string) => {
    await handleStatusChange(id, 'pending');
    await fetch(`/api/applications/${id}/submit`, { method: 'POST' });
    addToast('Queued for submission — check back in a few minutes', 'info');
  };

  return (
    <main className="min-h-screen bg-zinc-900">
      <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-100">Application Pipeline</h1>
        <p className="text-zinc-400 text-sm mt-1">{apps.length} applications total</p>
      </div>
      {loading ? (
        <p className="text-zinc-500 text-sm">Loading...</p>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : apps.length === 0 ? (
        <p className="text-zinc-500 text-sm">No applications yet. Go to <a href="/jobs" className="text-emerald-400 underline">/jobs</a> and click Tailor on a job.</p>
      ) : (
        <KanbanBoard
          applications={apps}
          jobs={jobs}
          onStatusChange={handleStatusChange}
          onApprove={handleApprove}
        />
      )}
      </div>
    </main>
  );
}
