'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/lib/toast';
import { TRANSITIONS } from '@/lib/application-state';
import { SPONSOR_BADGE, SPONSOR_LABEL, SEVERITY_COLORS } from '@/lib/ui';
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

function SponsorBadge({ status, evidence, lcaCount }: { status: string | null; evidence: string | null; lcaCount: number | null }) {
  const s = status ?? 'unknown';
  const withLca = (s === 'confirmed' || s === 'likely') && lcaCount ? ` (${lcaCount} LCAs)` : '';
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-[4px] font-medium cursor-default ${SPONSOR_BADGE[s] ?? SPONSOR_BADGE.unknown}`}
      title={evidence ?? undefined}
    >
      {(SPONSOR_LABEL[s] ?? s) + withLca}
    </span>
  );
}

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
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-stone text-sm">Loading...</p>
      </main>
    );
  }

  if (!app || !job) return null;

  const pdfSrc = docView === 'resume'
    ? `/api/applications/${id}/resume.pdf?v=${cacheKey}`
    : `/api/applications/${id}/cover.pdf?v=${cacheKey}`;

  return (
    <main className="min-h-screen">
      {/* Compact toolbar header: breadcrumb, identity, badges, actions on one row */}
      <div className="border-b border-seam bg-surface px-6 h-12 flex items-center gap-3 min-w-0">
        <Link href="/pipeline" className="text-stone hover:text-graphite text-xs flex-shrink-0">
          Pipeline
        </Link>
        <span className="text-faint text-xs flex-shrink-0">/</span>
        <h1 className="text-sm font-bold tracking-tight text-graphite truncate">
          {job.title} <span className="text-stone font-normal">· {job.company}</span>
        </h1>
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <SponsorBadge status={job.sponsor_status} evidence={job.sponsor_evidence} lcaCount={job.sponsor_lca_count} />
          {job.fit_score !== null && (
            <span className={`text-xs px-2 py-0.5 rounded-[4px] font-mono tabular-nums ${job.fit_score >= 75 ? 'bg-green-700/10 text-green-800 ring-1 ring-green-700/25' : job.fit_score >= 55 ? 'bg-amber-600/10 text-amber-800 ring-1 ring-amber-600/25' : 'bg-red-600/10 text-red-800 ring-1 ring-red-600/25'}`}>
              {job.fit_score} {job.fit_grade}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-[4px] font-medium ${app.status === 'draft' ? 'bg-sunken text-stone ring-1 ring-seam' : app.status === 'offer' ? 'bg-green-700/10 text-green-800 ring-1 ring-green-700/25' : 'bg-sunken text-graphite ring-1 ring-seam'}`}>
            {app.status}
          </span>
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-xs text-stone hover:text-graphite underline">
              View Job
            </a>
          )}
          {(app.status === 'draft' || !allowed.length) && (
            <button
              onClick={handleDelete}
              className="text-xs text-red-700 hover:text-red-800 border border-red-600/30 hover:border-red-600/60 px-2.5 py-1 rounded-[8px] transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Two-column body: toolbar is 48px + navbar 56px */}
      <div className="flex h-[calc(100vh-104px)]">
        {/* Left: PDF preview */}
        <div className="w-1/2 flex flex-col border-r border-seam">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-seam bg-surface">
            <div className="flex rounded-[8px] overflow-hidden ring-1 ring-seam">
              <button
                onClick={() => setDocView('resume')}
                className={`text-xs px-3 py-1.5 transition-colors ${docView === 'resume' ? 'bg-graphite text-white' : 'bg-sunken text-stone hover:text-graphite'}`}
              >
                Resume
              </button>
              <button
                onClick={() => { setDocView('cover'); if (!app.cover_letter) addToast('No cover letter yet', 'info'); }}
                className={`text-xs px-3 py-1.5 transition-colors ${docView === 'cover' ? 'bg-graphite text-white' : 'bg-sunken text-stone hover:text-graphite'}`}
              >
                Cover Letter
              </button>
            </div>
            <a
              href={pdfSrc}
              download
              className="ml-auto text-xs bg-surface border border-seam text-graphite hover:border-bronze rounded-[8px] transition-colors px-3 py-1.5"
            >
              Download
            </a>
          </div>
          <div className="flex-1 p-2 bg-sunken/60">
            <div className="h-full rounded-[8px] bg-white/5 ring-1 ring-white/10 p-1.5">
              <div className="relative h-full rounded-[8px] bg-raised slab-inner overflow-hidden">
                {pdfLoading && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-raised">
                    <div className="h-6 w-6 rounded-full border-2 border-seam border-t-bronze animate-spin" />
                    <p className="text-xs text-stone">Generating {docView === 'resume' ? 'resume' : 'cover letter'} PDF...</p>
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
          <div className="flex border-b border-seam bg-surface">
            {(['resume', 'cover', 'quality', 'prep', 'activity'] as Tab[]).map((t) => {
              const prepNudge = t === 'prep' && (app.status === 'screen' || app.status === 'interview');
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2.5 text-xs font-medium capitalize transition-colors border-b-2 ${tab === t ? 'text-bronze-strong border-bronze' : prepNudge ? 'text-amber-700 hover:text-amber-800 border-transparent' : 'text-stone hover:text-graphite border-transparent'}`}
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
                    className="text-xs bg-surface border border-seam text-graphite hover:border-bronze rounded-[8px] transition-colors px-3 py-1.5 disabled:opacity-50"
                  >
                    {retailoring ? retailorLabel ?? 'Tailoring...' : 'Re-Tailor'}
                  </button>
                </div>
                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  className="flex-1 min-h-96 w-full bg-surface border border-seam rounded-[8px] px-3 py-2 text-xs text-graphite font-mono resize-none focus:outline-none focus:border-bronze transition-colors placeholder-faint"
                  placeholder="Tailored resume text..."
                  spellCheck={false}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveResume}
                    disabled={saving}
                    className="text-xs bg-graphite text-white hover:bg-black active:scale-[0.98] rounded-[8px] transition-all px-4 py-1.5 disabled:opacity-50"
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
                  className="flex-1 min-h-96 w-full bg-surface border border-seam rounded-[8px] px-3 py-2 text-sm text-graphite resize-none focus:outline-none focus:border-bronze transition-colors placeholder-faint leading-relaxed"
                  placeholder="Cover letter text..."
                  spellCheck={true}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveCover}
                    disabled={saving}
                    className="text-xs bg-graphite text-white hover:bg-black active:scale-[0.98] rounded-[8px] transition-all px-4 py-1.5 disabled:opacity-50"
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
                      <h3 className="text-sm font-semibold text-graphite">Keyword Gap</h3>
                      <span className={`text-sm font-bold tabular-nums ${keywordGap.score >= 70 ? 'text-green-700' : keywordGap.score >= 50 ? 'text-amber-700' : 'text-red-700'}`}>
                        {keywordGap.score}/100
                      </span>
                    </div>
                    {keywordGap.missing.length > 0 && (
                      <div>
                        <p className="text-xs text-stone mb-1.5">Missing keywords</p>
                        <div className="flex flex-wrap gap-1.5">
                          {keywordGap.missing.map((kw) => (
                            <span key={kw} className="text-xs bg-red-600/10 text-red-800 ring-1 ring-red-600/25 px-2 py-0.5 rounded-[4px]">{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {keywordGap.found.length > 0 && (
                      <div>
                        <p className="text-xs text-stone mb-1.5">Found keywords</p>
                        <div className="flex flex-wrap gap-1.5">
                          {keywordGap.found.map((kw) => (
                            <span key={kw} className="text-xs bg-green-700/10 text-green-800 ring-1 ring-green-700/25 px-2 py-0.5 rounded-[4px]">{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-stone text-xs">No keyword gap data. Tailor this job first.</p>
                )}

                <div className="border-t border-hairline pt-4">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-sm font-semibold text-graphite">AI Critique</h3>
                    <button
                      onClick={handleCritique}
                      disabled={critiquing || !app.resume_text}
                      className="text-xs bg-surface border border-seam text-graphite hover:border-bronze rounded-[8px] transition-colors px-3 py-1 disabled:opacity-50"
                    >
                      {critiquing ? 'Analyzing...' : critique ? 'Re-run' : 'Run Critique'}
                    </button>
                    {critique && (
                      <span className={`text-sm font-bold tabular-nums ml-auto ${critique.ats_score >= 70 ? 'text-green-700' : critique.ats_score >= 50 ? 'text-amber-700' : 'text-red-700'}`}>
                        ATS {critique.ats_score}/100
                      </span>
                    )}
                  </div>
                  {critique && (
                    <div className="flex flex-col gap-2">
                      <p className="text-xs text-stone italic mb-1">{critique.verdict}</p>
                      {critique.issues.map((issue, i) => (
                        <div key={i} className={`rounded-[8px] border px-3 py-2 ${SEVERITY_COLORS[issue.severity]}`}>
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
                  <h3 className="text-sm font-semibold text-graphite">Interview Prep</h3>
                  <button
                    onClick={() => handlePrep(!!prep)}
                    disabled={prepping}
                    className="text-xs bg-surface border border-seam text-graphite hover:border-bronze rounded-[8px] transition-colors px-3 py-1 disabled:opacity-50"
                  >
                    {prepping ? 'Generating...' : prep ? 'Regenerate' : 'Generate Prep'}
                  </button>
                </div>

                {!prep && !prepping && (
                  <p className="text-stone text-xs">
                    Generates likely interview questions, STAR guidance from your real background, and talking points mapped to this JD.
                  </p>
                )}

                {prep && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h4 className="font-mono text-[11px] font-semibold text-green-700 uppercase tracking-[0.14em] mb-2">Technical Questions</h4>
                      <div className="flex flex-col gap-2">
                        {prep.technical.map((q, i) => (
                          <div key={i} className="rounded-[8px] border border-seam bg-surface px-3 py-2">
                            <p className="text-xs text-graphite font-medium mb-1">{q.question}</p>
                            <p className="text-xs text-stone">{q.guidance}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-mono text-[11px] font-semibold text-cyan-700 uppercase tracking-[0.14em] mb-2">Behavioral Questions</h4>
                      <div className="flex flex-col gap-2">
                        {prep.behavioral.map((q, i) => (
                          <div key={i} className="rounded-[8px] border border-seam bg-surface px-3 py-2">
                            <p className="text-xs text-graphite font-medium mb-1">{q.question}</p>
                            <p className="text-xs text-stone">{q.guidance}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-mono text-[11px] font-semibold text-indigo-700 uppercase tracking-[0.14em] mb-2">Questions to Ask Them</h4>
                      <ul className="flex flex-col gap-1.5 list-disc list-inside">
                        {prep.questions_to_ask.map((q, i) => (
                          <li key={i} className="text-xs text-graphite">{q}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-mono text-[11px] font-semibold text-amber-700 uppercase tracking-[0.14em] mb-2">Talking Points</h4>
                      <ul className="flex flex-col gap-1.5 list-disc list-inside">
                        {prep.talking_points.map((q, i) => (
                          <li key={i} className="text-xs text-graphite">{q}</li>
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
                  <h3 className="font-mono text-[11px] font-semibold text-faint uppercase tracking-[0.14em] mb-3">Status</h3>
                  <div className="flex flex-wrap gap-2">
                    {(app.status === 'draft' || app.status === 'pending') && (
                      <button
                        onClick={() => handleStatusChange('submitted')}
                        className="text-xs bg-graphite text-white hover:bg-black active:scale-[0.98] rounded-[8px] transition-all px-3 py-1.5"
                        title="I submitted this by hand; record it as submitted"
                      >
                        Mark Submitted
                      </button>
                    )}
                    {app.status === 'draft' && (
                      <button
                        onClick={() => handleStatusChange('pending')}
                        className="text-xs bg-surface border border-seam text-graphite hover:border-bronze rounded-[8px] transition-colors px-3 py-1.5"
                        title="Queue for the auto-apply worker (must be running separately)"
                      >
                        Approve and Queue
                      </button>
                    )}
                    {allowed.filter((s) => s !== 'pending' && s !== 'submitted').map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        className="text-xs bg-surface border border-seam text-graphite hover:border-bronze rounded-[8px] capitalize transition-colors px-3 py-1.5"
                      >
                        Move to {s}
                      </button>
                    ))}
                    {allowed.length === 0 && app.status !== 'draft' && (
                      <p className="text-xs text-faint">Terminal status. No further transitions.</p>
                    )}
                  </div>
                </div>

                <div className="border-t border-hairline pt-4 flex flex-col gap-2">
                  <h3 className="font-mono text-[11px] font-semibold text-faint uppercase tracking-[0.14em]">Timeline</h3>
                  <p className="text-xs text-stone">Created: {new Date(app.created_at).toLocaleString()}</p>
                  {app.applied_at && (
                    <p className="text-xs text-stone">Applied: {new Date(app.applied_at).toLocaleString()}</p>
                  )}
                  {app.submission_method && (
                    <p className="text-xs text-stone">Method: {app.submission_method}</p>
                  )}
                </div>

                {app.screenshot_path && (
                  <div className="border-t border-hairline pt-4">
                    <h3 className="font-mono text-[11px] font-semibold text-faint uppercase tracking-[0.14em] mb-2">Submission Screenshot</h3>
                    <img src={`file://${app.screenshot_path}`} alt="Submission screenshot" className="w-full rounded-[8px] border border-seam" />
                  </div>
                )}

                <div className="border-t border-hairline pt-4 flex flex-col gap-2">
                  <h3 className="font-mono text-[11px] font-semibold text-faint uppercase tracking-[0.14em]">Notes</h3>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full min-h-24 bg-surface border border-seam rounded-[8px] px-3 py-2 text-xs text-graphite resize-y focus:outline-none focus:border-bronze transition-colors placeholder-faint"
                    placeholder="Notes..."
                  />
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="self-end text-xs bg-surface border border-seam text-graphite hover:border-bronze rounded-[8px] transition-colors px-3 py-1.5 disabled:opacity-50"
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
