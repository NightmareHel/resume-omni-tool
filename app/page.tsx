'use client';

import { useState, useRef, useCallback } from 'react';
import StepIndicator from '@/components/StepIndicator';
import ATSAudit from '@/components/ATSAudit';
import KeywordGap from '@/components/KeywordGap';
import ResumeRewriter from '@/components/ResumeRewriter';
import { ATSResult } from '@/lib/ats-rules';
import { KeywordGapResult, RewriteResult } from '@/lib/claude';

type Step = 1 | 2 | 3 | 4;

export default function Home() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Resume input
  const [resumeText, setResumeText] = useState('');
  const [pastedResume, setPastedResume] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedFileRef = useRef<File | null>(null);

  // Step 2: ATS result
  const [atsResult, setATSResult] = useState<ATSResult | null>(null);

  // Step 3: JD + keyword gap
  const [jdText, setJDText] = useState('');
  const [gapResult, setGapResult] = useState<KeywordGapResult | null>(null);

  // Step 4: Rewrite
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null);

  function handleError(msg: string) {
    setError(msg);
    setLoading(false);
  }

  // --- Step 1: Parse resume ---
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
    if (hasFile) {
      formData.append('file', hasFile);
    } else {
      formData.append('text', pastedResume);
    }

    const res = await fetch('/api/parse-resume', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) return handleError(data.error ?? 'Failed to parse resume.');

    setResumeText(data.text);
    setATSResult(data.atsResult);
    setLoading(false);
    setStep(2);
  }

  // --- Step 3: Analyze JD ---
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

  // --- Step 4: Rewrite ---
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

  // --- Drag and drop ---
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-violet-600 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 9L6 3L10 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="6" cy="3" r="1" fill="white" />
              </svg>
            </div>
            <span className="font-semibold text-zinc-100 tracking-tight">ResumeOmniTool</span>
          </div>
          {step > 1 && (
            <button
              onClick={reset}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Start Over
            </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 flex flex-col gap-10">
        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Error banner */}
        {error && (
          <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Step 1: Resume Input */}
        {step === 1 && (
          <section className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-100">Upload your resume</h1>
              <p className="text-sm text-zinc-400 mt-1">PDF or DOCX for full format analysis. Paste plain text for content-only checks.</p>
            </div>

            {/* Upload zone */}
            <div
              onDragEnter={() => setDragActive(true)}
              onDragLeave={() => setDragActive(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => !fileName && fileInputRef.current?.click()}
              className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                dragActive
                  ? 'border-violet-500 bg-violet-500/5'
                  : fileName
                  ? 'border-emerald-500/50 bg-emerald-500/5 cursor-default'
                  : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileInput}
                className="hidden"
              />
              {fileName ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M3 9l4 4 8-8" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-emerald-400">{fileName}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); clearFile(); }}
                    className="text-xs text-zinc-500 hover:text-zinc-300 underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M9 12V4M9 4L6 7M9 4L12 7" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M3 14h12" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-sm text-zinc-400">
                    <span className="text-zinc-200 font-medium">Drop a file</span> or click to browse
                  </p>
                  <p className="text-xs text-zinc-600">PDF or DOCX — max 5MB</p>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-xs text-zinc-600">or paste plain text</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            {/* Paste area */}
            <textarea
              value={pastedResume}
              onChange={(e) => {
                setPastedResume(e.target.value);
                if (e.target.value) clearFile();
              }}
              placeholder="Paste your resume content here..."
              rows={10}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 placeholder-zinc-600 p-4 resize-y focus:outline-none focus:border-violet-500 transition-colors font-mono leading-relaxed"
            />

            <button
              onClick={handleParseResume}
              disabled={loading}
              className="self-start px-6 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Analyzing...' : 'Analyze Resume'}
            </button>
          </section>
        )}

        {/* Step 2: ATS Audit */}
        {step === 2 && atsResult && (
          <section className="flex flex-col gap-8">
            <ATSAudit result={atsResult} />

            <div className="border-t border-zinc-800 pt-8 flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">Add a job description</h2>
                <p className="text-sm text-zinc-400 mt-1">Paste the full job posting to get a keyword match analysis and targeted rewrite.</p>
              </div>
              <textarea
                value={jdText}
                onChange={(e) => setJDText(e.target.value)}
                placeholder="Paste the job description here..."
                rows={10}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 placeholder-zinc-600 p-4 resize-y focus:outline-none focus:border-violet-500 transition-colors leading-relaxed"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleAnalyzeJD}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Analyzing...' : 'Analyze Keywords'}
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Step 3: Keyword Gap */}
        {step === 3 && (
          <section className="flex flex-col gap-8">
            {gapResult ? (
              <>
                <KeywordGap result={gapResult} />
                <div className="border-t border-zinc-800 pt-6 flex gap-3">
                  <button
                    onClick={handleRewrite}
                    disabled={loading}
                    className="px-6 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Rewriting...' : 'Rewrite with Claude'}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100">Ready to rewrite</h2>
                  <p className="text-sm text-zinc-400 mt-1">No job description provided. Claude will optimize for general ATS best practices.</p>
                </div>
                <button
                  onClick={handleRewrite}
                  disabled={loading || !resumeText}
                  className="self-start px-6 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Rewriting...' : 'Rewrite with Claude'}
                </button>
              </div>
            )}
          </section>
        )}

        {/* Step 4: Rewrite output */}
        {step === 4 && rewriteResult && (
          <section>
            <ResumeRewriter result={rewriteResult} />
          </section>
        )}
      </main>
    </div>
  );
}
