'use client';

import { useState, useEffect, useCallback } from 'react';
import JobCard from './JobCard';
import JobFilters, { type JobFiltersState } from './JobFilters';
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
}

interface Props {
  onTailor?: (jobId: string, onProgress?: (label: string) => void) => void | Promise<void>;
}

export default function JobBoard({ onTailor }: Props) {
  const { addToast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [tailoringId, setTailoringId] = useState<string | null>(null);
  const [tailorLabel, setTailorLabel] = useState<string | null>(null);
  const [filters, setFilters] = useState<JobFiltersState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('jp_filters');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return { source: '', status: '', minScore: 0, search: '', sort: 'scraped_at' };
  });

  const loadJobs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('excludeCustom', 'true');
    if (filters.source)         params.set('source', filters.source);
    if (filters.status)         params.set('status', filters.status);
    if (filters.minScore > 0)   params.set('minScore', String(filters.minScore));
    if (filters.search)         params.set('search', filters.search);
    if (filters.sort)           params.set('sort', filters.sort);
    params.set('limit', '100');

    const res = await fetch(`/api/jobs?${params}`);
    const data = await res.json();
    setJobs(data.jobs ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [filters]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const handleFiltersChange = (next: JobFiltersState) => {
    setFilters(next);
    try { localStorage.setItem('jp_filters', JSON.stringify(next)); } catch {}
  };

  const handleScrape = async () => {
    setScraping(true);
    const res = await fetch('/api/scrape', { method: 'POST' });
    const { runId } = await res.json();
    // Poll until scrape_run is no longer running
    const poll = async () => {
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const s = await fetch('/api/scrape').then((r) => r.json());
        if (s.latest && s.latest.status !== 'running') {
          const found = s.latest.jobs_found ?? 0;
          addToast(`Scrape complete — ${found} new job${found === 1 ? '' : 's'} found`, 'success');
          break;
        }
      }
    };
    poll().catch(() => {}).finally(() => { setScraping(false); loadJobs(); });
    // Don't await poll — let scraping continue in background
    void runId; // runId used for future per-run status page
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
      const body = await res.json().catch(() => ({}));
      addToast((body as { error?: string }).error ?? `Scoring failed (${res.status})`, 'error');
    }
    setScoringId(null);
  };

  const handleScoreAll = async () => {
    const unscored = jobs.filter((j) => j.fit_score === null);
    if (unscored.length === 0) { addToast('All jobs already scored', 'info'); return; }
    addToast(`Scoring ${unscored.length} job${unscored.length === 1 ? '' : 's'}...`, 'info');
    for (let i = 0; i < unscored.length; i++) {
      const job = unscored[i];
      setScoringId(job.id);
      const res = await fetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id }),
      });
      if (res.ok) {
        const { score, grade, summary } = await res.json();
        setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, fit_score: score, fit_grade: grade, fit_summary: summary } : j));
      }
      if (i < unscored.length - 1) await new Promise((r) => setTimeout(r, 500));
    }
    setScoringId(null);
    addToast('Scoring complete', 'success');
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Job Board</h1>
          <p className="text-zinc-400 text-sm">{total} jobs in database</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleScoreAll}
            disabled={!!scoringId || loading}
            className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {scoringId ? 'Scoring...' : 'Score All'}
          </button>
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {scraping ? 'Scraping...' : 'Scrape Now'}
          </button>
        </div>
      </div>

      <JobFilters filters={filters} onChange={handleFiltersChange} />

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading...</p>
      ) : jobs.length === 0 ? (
        <p className="text-zinc-500 text-sm">No jobs found. Try scraping or adjusting filters.</p>
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
