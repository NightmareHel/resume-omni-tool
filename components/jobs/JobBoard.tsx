'use client';

import { useState, useEffect, useCallback } from 'react';
import JobRow from './JobRow';
import JobFilters, { type JobFiltersState } from './JobFilters';
import { useToast } from '@/lib/toast';
import { tailorJob } from '@/lib/tailor-client';
import { BTN } from '@/lib/ui';

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

export default function JobBoard({ onTailor }: Props) {
  const { addToast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [tailoringId, setTailoringId] = useState<string | null>(null);
  const [tailorLabel, setTailorLabel] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<{ done: number; total: number; label: string } | null>(null);
  const FILTER_DEFAULTS: JobFiltersState = { source: '', status: '', minScore: 0, search: '', sort: 'scraped_at', hideBlocked: false, entryOnly: false, sponsorStatus: '' };

  const [filters, setFilters] = useState<JobFiltersState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('jp_filters');
        if (saved) return { ...FILTER_DEFAULTS, ...JSON.parse(saved) };
      } catch {}
    }
    return FILTER_DEFAULTS;
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
    if (filters.hideBlocked)    params.set('hideBlocked', 'true');
    if (filters.entryOnly)      params.set('entryOnly', 'true');
    if (filters.sponsorStatus)  params.set('sponsorStatus', filters.sponsorStatus);
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
          addToast(`Scrape complete: ${found} new job${found === 1 ? '' : 's'} found`, 'success');
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
    if (!onTailor || batch) return;
    setTailoringId(id);
    setTailorLabel(null);
    await onTailor(id, setTailorLabel);
    setTailoringId(null);
    setTailorLabel(null);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBatchTailor = async () => {
    // Preserve board order; serial so each job's 3 parallel AI calls don't stack into 429s
    const queue = jobs.filter((j) => selected.has(j.id));
    if (queue.length === 0 || batch) return;
    const failures: string[] = [];
    for (let i = 0; i < queue.length; i++) {
      const job = queue[i];
      const progress = (label: string) => setBatch({ done: i, total: queue.length, label: `${job.company}: ${label}` });
      setBatch({ done: i, total: queue.length, label: job.company });
      let result = await tailorJob(job.id, progress);
      if (!result.ok && (result.status === 429 || /rate.?limit/i.test(result.error))) {
        setBatch({ done: i, total: queue.length, label: `${job.company}: rate limited, retrying in 30s` });
        await new Promise((r) => setTimeout(r, 30000));
        result = await tailorJob(job.id, progress);
      }
      if (result.ok) {
        setSelected((prev) => { const next = new Set(prev); next.delete(job.id); return next; });
      } else {
        failures.push(`${job.company}: ${result.error}`);
      }
    }
    setBatch(null);
    const okCount = queue.length - failures.length;
    if (failures.length === 0) {
      addToast(`Tailored ${okCount} job${okCount === 1 ? '' : 's'}. Drafts are in the pipeline.`, 'success');
    } else {
      addToast(`Tailored ${okCount} of ${queue.length}. Failed: ${failures.join('; ')}`, 'error');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-graphite">Job Board</h1>
          <p className="text-stone text-sm">{total} jobs in database</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleScoreAll}
            disabled={!!scoringId || loading}
            className="bg-surface border border-seam text-graphite hover:border-bronze rounded-[8px] transition-colors text-sm px-4 py-2 disabled:opacity-50"
          >
            {scoringId ? 'Scoring...' : 'Score All'}
          </button>
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="bg-surface border border-seam text-graphite hover:border-bronze rounded-[8px] transition-colors text-sm px-4 py-2 disabled:opacity-50"
          >
            {scraping ? 'Scraping...' : 'Scrape Now'}
          </button>
        </div>
      </div>

      {/* Sticky filter bar: stays pinned under the navbar while the queue scrolls */}
      <div className="sticky top-14 z-20 bg-quartz/90 backdrop-blur-md -mx-6 px-6 py-3 border-b border-hairline">
        <JobFilters filters={filters} onChange={handleFiltersChange} />
        {(selected.size > 0 || batch) && (
          <div className="flex items-center gap-3 mt-2.5">
            {batch ? (
              <span className="text-xs text-stone tabular-nums">
                Tailoring {batch.done + 1}/{batch.total}: {batch.label}
              </span>
            ) : (
              <>
                <button
                  onClick={handleBatchTailor}
                  disabled={!!tailoringId}
                  className={`text-xs px-3 py-1.5 disabled:opacity-50 ${BTN.primary}`}
                >
                  Tailor {selected.size} selected
                </button>
                <button onClick={() => setSelected(new Set())} className={`text-xs px-2 py-1.5 ${BTN.ghost}`}>
                  Clear
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 bg-sunken rounded-[8px] animate-pulse" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <p className="text-stone text-sm py-8 text-center">No jobs found. Try scraping or adjusting filters.</p>
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
              selected={selected.has(job.id)}
              onSelectToggle={toggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
