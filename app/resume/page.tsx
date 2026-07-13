'use client';

import { useState, useRef, useCallback } from 'react';
import StepIndicator from '@/components/StepIndicator';
import ATSAudit from '@/components/ATSAudit';
import KeywordGap from '@/components/KeywordGap';
import ResumeRewriter from '@/components/ResumeRewriter';
import { ATSResult } from '@/lib/ats-rules';
import { KeywordGapResult, RewriteResult } from '@/lib/claude';

type Step = 1 | 2 | 3 | 4;

export default function ResumePage() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resumeText, setResumeText] = useState('');
  const [pastedResume, setPastedResume] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedFileRef = useRef<File | null>(null);

  const [atsResult, setATSResult] = useState<ATSResult | null>(null);
  const [jdText, setJDText] = useState('');
  const [gapResult, setGapResult] = useState<KeywordGapResult | null>(null);
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null);

  function handleError(msg: string) {
    setError(msg);
    setLoading(false);
  }

  async function handleParseResume() {
    setError(null);
    const hasFile = uploadedFileRef.current;
    const hasPaste = pastedResume.trim().length > 50;
    if (!hasFile && !hasPaste) {
      setError('Upload a PDF/DOCX or paste at least 50 characters of resume text.');
      return;
    }
    setLoading(true);
    const formData = new FormData();
    if (hasFile) formData.append('file', hasFile);
    else formData.append('text', pastedResume);
    const res = await fetch('/api/parse-resume', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) return handleError(data.error ?? 'Failed to parse resume.');
    setResumeText(data.text);
    setATSResult(data.atsResult);
    setLoading(false);
    setStep(2);
  }

  async function handleAnalyzeJD() {
    if (!jdText.trim() || jdText.trim().length < 50) {
      setError('Paste a job description (at least 50 characters).');
      return;
    }
    setError(null);
    setLoading(true);
    const res = await fetch('/api/analyze-jd', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText, jdText }),
    });
    const data = await res.json();
    if (!res.ok) return handleError(data.error ?? 'Failed to analyze job description.');
    setGapResult(data);
    setLoading(false);
    setStep(3);
  }

  async function handleRewrite() {
    setError(null);
    setLoading(true);
    const res = await fetch('/api/rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText, jdText }),
    });
    const data = await res.json();
    if (!res.ok) return handleError(data.error ?? 'Failed to rewrite resume.');
    setRewriteResult(data);
    setLoading(false);
    setStep(4);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    uploadedFileRef.current = file;
    setFileName(file.name);
    setPastedResume('');
  }, []);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadedFileRef.current = file;
    setFileName(file.name);
    setPastedResume('');
  }

  function clearFile() {
    uploadedFileRef.current = null;
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function reset() {
    setStep(1);
    setResumeText('');
    setPastedResume('');
    setFileName(null);
    uploadedFileRef.current = null;
    setATSResult(null);
    setJDText('');
    setGapResult(null);
    setRewriteResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-hairline bg-quartz/85 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-semibold text-graphite tracking-tight">Resume Analyzer</span>
          {step > 1 && (
            <button onClick={reset} className="text-xs text-stone hover:text-graphite transition-colors">
              Start Over
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-10 items-start">
        <aside className="lg:sticky lg:top-20">
          <StepIndicator current={step} />
        </aside>

        <div className="flex flex-col gap-10 min-w-0">
        {error && (
          <div className="p-3.5 rounded-[8px] bg-red-600/10 border border-red-600/25 text-sm text-red-800">
            {error}
          </div>
        )}

        {step === 1 && (
          <section className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-semibold text-graphite">Upload your resume</h1>
              <p className="text-sm text-stone mt-1">PDF or DOCX for full format analysis. Paste plain text for content-only checks.</p>
            </div>
            <div
              onDragEnter={() => setDragActive(true)}
              onDragLeave={() => setDragActive(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => !fileName && fileInputRef.current?.click()}
              className={`relative rounded-[14px] border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                dragActive ? 'border-bronze bg-bronze/5' : fileName ? 'border-bronze/50 bg-bronze/5 cursor-default' : 'border-seam hover:border-bronze/50 hover:bg-sunken/60'
              }`}
            >
              <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" onChange={handleFileInput} className="hidden" />
              {fileName ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-green-700/15 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M3 9l4 4 8-8" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-green-700">{fileName}</span>
                  <button onClick={(e) => { e.stopPropagation(); clearFile(); }} className="text-xs text-stone hover:text-graphite underline">Remove</button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-sunken flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M9 12V4M9 4L6 7M9 4L12 7" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M3 14h12" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-sm text-stone"><span className="text-graphite font-medium">Drop a file</span> or click to browse</p>
                  <p className="text-xs text-faint">PDF or DOCX, max 5MB</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-sunken" />
              <span className="text-xs text-faint">or paste plain text</span>
              <div className="flex-1 h-px bg-sunken" />
            </div>
            <textarea
              value={pastedResume}
              onChange={(e) => { setPastedResume(e.target.value); if (e.target.value) clearFile(); }}
              placeholder="Paste your resume content here..."
              rows={10}
              className="w-full rounded-[8px] bg-surface border border-hairline text-sm text-graphite placeholder-faint p-4 resize-y focus:outline-none focus:border-bronze transition-colors font-mono leading-relaxed"
            />
            <button
              onClick={handleParseResume}
              disabled={loading}
              className="self-start px-6 py-2.5 rounded-[8px] bg-green-700 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Analyzing...' : 'Analyze Resume'}
            </button>
          </section>
        )}

        {step === 2 && atsResult && (
          <section className="flex flex-col gap-8">
            <ATSAudit result={atsResult} />
            <div className="border-t border-hairline pt-8 flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-graphite">Add a job description</h2>
                <p className="text-sm text-stone mt-1">Paste the full job posting to get a keyword match analysis and targeted rewrite.</p>
              </div>
              <textarea
                value={jdText}
                onChange={(e) => setJDText(e.target.value)}
                placeholder="Paste the job description here..."
                rows={10}
                className="w-full rounded-[8px] bg-surface border border-hairline text-sm text-graphite placeholder-faint p-4 resize-y focus:outline-none focus:border-bronze transition-colors leading-relaxed"
              />
              <div className="flex gap-3">
                <button onClick={handleAnalyzeJD} disabled={loading} className="px-6 py-2.5 rounded-[8px] bg-green-700 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {loading ? 'Analyzing...' : 'Analyze Keywords'}
                </button>
                <button onClick={() => setStep(3)} className="px-6 py-2.5 rounded-[8px] bg-sunken text-graphite text-sm font-medium hover:bg-seam transition-colors">Skip</button>
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="flex flex-col gap-8">
            {gapResult ? (
              <>
                <KeywordGap result={gapResult} />
                <div className="border-t border-hairline pt-6 flex gap-3">
                  <button onClick={handleRewrite} disabled={loading} className="px-6 py-2.5 rounded-[8px] bg-green-700 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {loading ? 'Rewriting...' : 'Rewrite Resume'}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-graphite">Ready to rewrite</h2>
                  <p className="text-sm text-stone mt-1">No job description provided. Will optimize for general ATS best practices.</p>
                </div>
                <button onClick={handleRewrite} disabled={loading || !resumeText} className="self-start px-6 py-2.5 rounded-[8px] bg-green-700 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {loading ? 'Rewriting...' : 'Rewrite Resume'}
                </button>
              </div>
            )}
          </section>
        )}

        {step === 4 && rewriteResult && (
          <section>
            <ResumeRewriter result={rewriteResult} />
          </section>
        )}
        </div>
      </main>
    </div>
  );
}
