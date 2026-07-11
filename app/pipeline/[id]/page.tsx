'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/lib/toast';
import { TRANSITIONS } from '@/lib/application-state';
import type { KeywordGapResult, CritiqueResult, InterviewPrepResult } from '@/lib/claude';

interface Application {
  id: string;
  job_id: string;
  status: string;
  resume_text: string | null;
  cover_letter: string | null;
  keyword_gap: string | null;
  interview_prep: string | null;
  notes: string | null;
  created_at: string;
  applied_at: string | null;
  screenshot_path: string | null;
  submission_method: string | null;
}

interface Job {
  id: string;
  title: string;
  company: string;
  source: string;
  url: string;
  fit_score: number | null;
  fit_grade: string | null;
  sponsor_status: string | null;
  sponsor_evidence: string | null;
  sponsor_lca_count: number | null;
  entry_level: number | null;
  years_required: number | null;
}

type Tab = 'resume' | 'cover' | 'quality' | 'prep' | 'activity';
type DocView = 'resume' | 'cover';

const SPONSOR_STYLES: Record<string, { cls: string; label: (lca: number | null) => string }> = {
  confirmed: { cls: 'bg-emerald-900 text-emerald-300 ring-1 ring-emerald-700', label: (n) => `Sponsors${n ? ` (${n} LCAs)` : ''}` },
  likely:    { cls: 'bg-emerald-950 text-emerald-400 ring-1 ring-emerald-800', label: (n) => `Likely Sponsors${n ? ` (${n} LCAs)` : ''}` },
  possible:  { cls: 'bg-yellow-950 text-yellow-400 ring-1 ring-yellow-800',   label: () => 'Possible Sponsor' },
  unknown:   { cls: 'bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700',         label: () => 'Unknown Sponsorship' },
  unlikely:  { cls: 'bg-orange-950 text-orange-400 ring-1 ring-orange-800',   label: () => 'Unlikely to Sponsor' },
  blocked:   { cls: 'bg-red-950 text-red-400 ring-1 ring-red-800',            label: () => 'No Sponsorship' },
};

function SponsorBadge({ status, evidence, lcaCount }: { status: string | null; evidence: string | null; lcaCount: number | null }) {
  const s = status ?? 'unknown';
  const style = SPONSOR_STYLES[s] ?? SPONSOR_STYLES.unknown;
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded font-medium cursor-default ${style.cls}`}
      title={evidence ?? undefined}
    >
      {style.label(lcaCount)}
    </span>
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  high:   'text-red-400 bg-red-950 border-red-800',
  medium: 'text-amber-400 bg-amber-950 border-amber-800',
  low:    'text-zinc-400 bg-zinc-800 border-zinc-700',
};

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [app, setApp] = useState<Application | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>('resume');
  const [docView, setDocView] = useState<DocView>('resume');
  const [cacheKey, setCacheKey] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(true);

  // Editor state
  const [resumeText, setResumeText] = useState('');
  const [coverText, setCoverText] = useState('');
  const [saving, setSaving] = useState(false);

  // Quality tab
  const [critique, setCritique] = useState<CritiqueResult | null>(null);
  const [critiquing, setCritiquing] = useState(false);

  // Prep tab
  const [prep, setPrep] = useState<InterviewPrepResult | null>(null);
  const [prepping, setPrepping] = useState(false);

  // Re-tailor
  const [retailoring, setRetailoring] = useState(false);
  const [retailorLabel, setRetailorLabel] = useState<string | null>(null);

  // Notes
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/applications/${id}`);
      if (!res.ok) { addToast('Application not found', 'error'); router.push('/pipeline'); return; }
      const data = await res.json();
      setApp(data.application);
      setJob(data.job);
      setResumeText(data.application.resume_text ?? '');
      setCoverText(data.application.cover_letter ?? '');
      setNotes(data.application.notes ?? '');
      if (data.application.interview_prep) {
        try { setPrep(JSON.parse(data.application.interview_prep)); } catch {}
      }
    } catch {
      addToast('Failed to load application', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, router, addToast]);

  useEffect(() => { load(); }, [load]);

  // The iframe remounts (key={docView-cacheKey}) whenever the PDF src changes;
  // reset the loading overlay so it shows again until the new PDF finishes.
  useEffect(() => { setPdfLoading(true); }, [docView, cacheKey]);

  const patch = async (body: Record<string, string | null>) => {
    const res = await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      addToast((error as string) ?? 'Update failed', 'error');
      return null;
    }
    const { application } = await res.json();
    setApp(application);
    return application;
  };

  const handleSaveResume = async () => {
    setSaving(true);
    const updated = await patch({ resume_text: resumeText });
    if (updated) { addToast('Resume saved', 'success'); setCacheKey((k) => k + 1); }
    setSaving(false);
  };

  const handleSaveCover = async () => {
    setSaving(true);
    const updated = await patch({ cover_letter: coverText });
    if (updated) { addToast('Cover letter saved', 'success'); setCacheKey((k) => k + 1); }
    setSaving(false);
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    await patch({ notes });
    setSavingNotes(false);
  };

  const handleStatusChange = async (status: string) => {
    await patch({ status });
  };

  const handleDelete = async () => {
    if (!confirm('Delete this application? This cannot be undone.')) return;
    const res = await fetch(`/api/applications/${id}`, { method: 'DELETE' });
    if (res.ok) { addToast('Application deleted', 'success'); router.push('/pipeline'); }
    else { const { error } = await res.json().catch(() => ({})); addToast((error as string) ?? 'Delete failed', 'error'); }
  };

  const handleRetailor = async () => {
    setRetailoring(true);
    setRetailorLabel('Starting...');
    try {
      const res = await fetch(`/api/applications/${id}/retailor`, { method: 'POST' });
      if (!res.ok || !res.body) { addToast('Re-tailor failed', 'error'); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === 'stage') {
              const labels: Record<string, string> = { gap: '1/3 keyword gap', rewrite: '2/3 rewrite', cover: '3/3 cover letter' };
              setRetailorLabel(labels[evt.stage] ?? evt.stage);
            }
            if (evt.type === 'done') {
              setApp(evt.application);
              setResumeText(evt.application.resume_text ?? '');
              setCoverText(evt.application.cover_letter ?? '');
              setCacheKey((k) => k + 1);
              addToast('Re-tailored successfully', 'success');
            }
            if (evt.type === 'error') addToast(evt.error, 'error');
          } catch {}
        }
      }
    } catch {
      addToast('Re-tailor failed', 'error');
    } finally {
      setRetailoring(false);
      setRetailorLabel(null);
    }
  };

  const handlePrep = async (force = false) => {
    setPrepping(true);
    try {
      const res = await fetch(`/api/applications/${id}/interview-prep${force ? '?force=true' : ''}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { addToast(data.error ?? 'Prep generation failed', 'error'); return; }
      setPrep(data.prep);
      if (!data.cached) addToast('Interview prep generated', 'success');
    } catch {
      addToast('Prep generation failed', 'error');
    } finally {
      setPrepping(false);
    }
  };

  const handleCritique = async () => {
    setCritiquing(true);
    try {
      const res = await fetch(`/api/applications/${id}/critique`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { addToast(data.error ?? 'Critique failed', 'error'); return; }
      setCritique(data);
    } catch {
      addToast('Critique failed', 'error');
    } finally {
      setCritiquing(false);
    }
  };

  const keywordGap: KeywordGapResult | null = (() => {
    if (!app?.keyword_gap) return null;
    try { return JSON.parse(app.keyword_gap); } catch { return null; }
  })();

  const allowed = TRANSITIONS[app?.status ?? ''] ?? [];

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Loading...</p>
      </main>
    );
  }

  if (!app || !job) return null;

  const pdfSrc = docView === 'resume'
    ? `/api/applications/${id}/resume.pdf?v=${cacheKey}`
    : `/api/applications/${id}/cover.pdf?v=${cacheKey}`;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/pipeline" className="text-zinc-500 hover:text-zinc-300 text-xs">
              Pipeline
            </Link>
            <span className="text-zinc-700 text-xs">/</span>
            <span className="text-zinc-400 text-xs truncate max-w-64">{job.title} at {job.company}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-lg font-bold text-zinc-100">{job.title}</h1>
            <span className="text-zinc-400 text-sm">{job.company}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SponsorBadge status={job.sponsor_status} evidence={job.sponsor_evidence} lcaCount={job.sponsor_lca_count} />
            {job.fit_score !== null && (
              <span className={`text-xs px-2 py-0.5 rounded font-mono tabular-nums ${job.fit_score >= 75 ? 'bg-emerald-950 text-emerald-400 ring-1 ring-emerald-800' : job.fit_score >= 55 ? 'bg-amber-950 text-amber-400 ring-1 ring-amber-800' : 'bg-red-950 text-red-400 ring-1 ring-red-800'}`}>
                {job.fit_score} {job.fit_grade}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${app.status === 'draft' ? 'bg-zinc-700 text-zinc-300' : app.status === 'offer' ? 'bg-emerald-900 text-emerald-200' : 'bg-zinc-800 text-zinc-300'}`}>
              {app.status}
            </span>
            {job.url && (
              <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-500 hover:text-zinc-300 underline">
                View Job
              </a>
            )}
          </div>
        </div>
        {(app.status === 'draft' || !allowed.length) && (
          <button
            onClick={handleDelete}
            className="flex-shrink-0 text-xs text-red-500 hover:text-red-400 border border-red-900 hover:border-red-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      {/* Two-column body */}
      <div className="flex h-[calc(100vh-120px)]">
        {/* Left: PDF preview */}
        <div className="w-1/2 flex flex-col border-r border-zinc-800">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
            <div className="flex rounded-lg overflow-hidden ring-1 ring-zinc-700">
              <button
                onClick={() => setDocView('resume')}
                className={`text-xs px-3 py-1.5 transition-colors ${docView === 'resume' ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
              >
                Resume
              </button>
              <button
                onClick={() => { setDocView('cover'); if (!app.cover_letter) addToast('No cover letter yet', 'info'); }}
                className={`text-xs px-3 py-1.5 transition-colors ${docView === 'cover' ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
              >
                Cover Letter
              </button>
            </div>
            <a
              href={pdfSrc}
              download
              className="ml-auto text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              Download
            </a>
          </div>
          <div className="flex-1 p-2 bg-zinc-800/30">
            <div className="h-full rounded-lg bg-white/5 ring-1 ring-white/10 p-1.5">
              <div className="relative h-full rounded bg-zinc-900/80 ring-1 ring-white/5 overflow-hidden">
                {pdfLoading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-zinc-900">
                    <div className="h-6 w-6 rounded-full border-2 border-zinc-700 border-t-emerald-500 animate-spin" />
                    <p className="text-xs text-zinc-500">Generating {docView === 'resume' ? 'resume' : 'cover letter'} PDF...</p>
                  </div>
                )}
                <iframe
                  key={`${docView}-${cacheKey}`}
                  src={pdfSrc}
                  onLoad={() => setPdfLoading(false)}
                  className="w-full h-full"
                  title={docView === 'resume' ? 'Resume PDF' : 'Cover Letter PDF'}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Tabs */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-zinc-800 bg-zinc-900/30">
            {(['resume', 'cover', 'quality', 'prep', 'activity'] as Tab[]).map((t) => {
              const prepNudge = t === 'prep' && (app.status === 'screen' || app.status === 'interview');
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2.5 text-xs font-medium capitalize transition-colors border-b-2 ${tab === t ? 'text-emerald-400 border-emerald-500' : prepNudge ? 'text-amber-400 hover:text-amber-300 border-transparent' : 'text-zinc-400 hover:text-zinc-200 border-transparent'}`}
                >
                  {t === 'quality' ? 'Quality' : t === 'activity' ? 'Activity' : t === 'cover' ? 'Cover Letter' : t === 'prep' ? `Prep${prepNudge ? ' !' : ''}` : 'Resume'}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Resume editor tab */}
            {tab === 'resume' && (
              <div className="flex flex-col gap-3 h-full">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleRetailor}
                    disabled={retailoring || app.status !== 'draft'}
                    className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {retailoring ? retailorLabel ?? 'Tailoring...' : 'Re-Tailor'}
                  </button>
                </div>
                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  className="flex-1 min-h-96 w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono resize-none focus:outline-none focus:border-emerald-600 transition-colors placeholder-zinc-600"
                  placeholder="Tailored resume text..."
                  spellCheck={false}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveResume}
                    disabled={saving}
                    className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save + Refresh PDF'}
                  </button>
                </div>
              </div>
            )}

            {/* Cover letter editor tab */}
            {tab === 'cover' && (
              <div className="flex flex-col gap-3 h-full">
                <textarea
                  value={coverText}
                  onChange={(e) => setCoverText(e.target.value)}
                  className="flex-1 min-h-96 w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 resize-none focus:outline-none focus:border-emerald-600 transition-colors placeholder-zinc-600 leading-relaxed"
                  placeholder="Cover letter text..."
                  spellCheck={true}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveCover}
                    disabled={saving}
                    className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save + Refresh PDF'}
                  </button>
                </div>
              </div>
            )}

            {/* Quality tab */}
            {tab === 'quality' && (
              <div className="flex flex-col gap-5">
                {keywordGap ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-zinc-200">Keyword Gap</h3>
                      <span className={`text-sm font-bold tabular-nums ${keywordGap.score >= 70 ? 'text-emerald-400' : keywordGap.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                        {keywordGap.score}/100
                      </span>
                    </div>
                    {keywordGap.missing.length > 0 && (
                      <div>
                        <p className="text-xs text-zinc-500 mb-1.5">Missing keywords</p>
                        <div className="flex flex-wrap gap-1.5">
                          {keywordGap.missing.map((kw) => (
                            <span key={kw} className="text-xs bg-red-950 text-red-400 ring-1 ring-red-800 px-2 py-0.5 rounded">{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {keywordGap.found.length > 0 && (
                      <div>
                        <p className="text-xs text-zinc-500 mb-1.5">Found keywords</p>
                        <div className="flex flex-wrap gap-1.5">
                          {keywordGap.found.map((kw) => (
                            <span key={kw} className="text-xs bg-emerald-950 text-emerald-400 ring-1 ring-emerald-800 px-2 py-0.5 rounded">{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-xs">No keyword gap data. Tailor this job first.</p>
                )}

                <div className="border-t border-zinc-800 pt-4">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-sm font-semibold text-zinc-200">AI Critique</h3>
                    <button
                      onClick={handleCritique}
                      disabled={critiquing || !app.resume_text}
                      className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-3 py-1 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {critiquing ? 'Analyzing...' : critique ? 'Re-run' : 'Run Critique'}
                    </button>
                    {critique && (
                      <span className={`text-sm font-bold tabular-nums ml-auto ${critique.ats_score >= 70 ? 'text-emerald-400' : critique.ats_score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                        ATS {critique.ats_score}/100
                      </span>
                    )}
                  </div>
                  {critique && (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-zinc-400 italic mb-1">{critique.verdict}</p>
                      {critique.issues.map((issue, i) => (
                        <div key={i} className={`rounded-lg border px-3 py-2 ${SEVERITY_COLORS[issue.severity]}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold uppercase tracking-wide opacity-70">{issue.severity}</span>
                          </div>
                          <p className="text-xs mb-1">{issue.issue}</p>
                          <p className="text-xs opacity-70">Fix: {issue.fix}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prep tab */}
            {tab === 'prep' && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-zinc-200">Interview Prep</h3>
                  <button
                    onClick={() => handlePrep(!!prep)}
                    disabled={prepping}
                    className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-3 py-1 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {prepping ? 'Generating...' : prep ? 'Regenerate' : 'Generate Prep'}
                  </button>
                </div>

                {!prep && !prepping && (
                  <p className="text-zinc-500 text-xs">
                    Generates likely interview questions, STAR guidance from your real background, and talking points mapped to this JD.
                  </p>
                )}

                {prep && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-2">Technical Questions</h4>
                      <div className="flex flex-col gap-2">
                        {prep.technical.map((q, i) => (
                          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                            <p className="text-xs text-zinc-200 font-medium mb-1">{q.question}</p>
                            <p className="text-xs text-zinc-500">{q.guidance}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wide mb-2">Behavioral Questions</h4>
                      <div className="flex flex-col gap-2">
                        {prep.behavioral.map((q, i) => (
                          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                            <p className="text-xs text-zinc-200 font-medium mb-1">{q.question}</p>
                            <p className="text-xs text-zinc-500">{q.guidance}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-violet-400 uppercase tracking-wide mb-2">Questions to Ask Them</h4>
                      <ul className="flex flex-col gap-1.5 list-disc list-inside">
                        {prep.questions_to_ask.map((q, i) => (
                          <li key={i} className="text-xs text-zinc-300">{q}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">Talking Points</h4>
                      <ul className="flex flex-col gap-1.5 list-disc list-inside">
                        {prep.talking_points.map((q, i) => (
                          <li key={i} className="text-xs text-zinc-300">{q}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Activity tab */}
            {tab === 'activity' && (
              <div className="flex flex-col gap-5">
                <div>
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Status</h3>
                  <div className="flex flex-wrap gap-2">
                    {(app.status === 'draft' || app.status === 'pending') && (
                      <button
                        onClick={() => handleStatusChange('submitted')}
                        className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                        title="I submitted this by hand — record it as submitted"
                      >
                        Mark Submitted
                      </button>
                    )}
                    {app.status === 'draft' && (
                      <button
                        onClick={() => handleStatusChange('pending')}
                        className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-3 py-1.5 rounded-lg transition-colors"
                        title="Queue for the auto-apply worker (must be running separately)"
                      >
                        Approve and Queue
                      </button>
                    )}
                    {allowed.filter((s) => s !== 'pending' && s !== 'submitted').map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-3 py-1.5 rounded-lg capitalize transition-colors"
                      >
                        Move to {s}
                      </button>
                    ))}
                    {allowed.length === 0 && app.status !== 'draft' && (
                      <p className="text-xs text-zinc-600">Terminal status — no further transitions.</p>
                    )}
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-4 flex flex-col gap-2">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Timeline</h3>
                  <p className="text-xs text-zinc-500">Created: {new Date(app.created_at).toLocaleString()}</p>
                  {app.applied_at && (
                    <p className="text-xs text-zinc-500">Applied: {new Date(app.applied_at).toLocaleString()}</p>
                  )}
                  {app.submission_method && (
                    <p className="text-xs text-zinc-500">Method: {app.submission_method}</p>
                  )}
                </div>

                {app.screenshot_path && (
                  <div className="border-t border-zinc-800 pt-4">
                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Submission Screenshot</h3>
                    <img src={`file://${app.screenshot_path}`} alt="Submission screenshot" className="w-full rounded-lg border border-zinc-700" />
                  </div>
                )}

                <div className="border-t border-zinc-800 pt-4 flex flex-col gap-2">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Notes</h3>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full min-h-24 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 resize-y focus:outline-none focus:border-emerald-600 transition-colors placeholder-zinc-600"
                    placeholder="Notes..."
                  />
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="self-end text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {savingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
