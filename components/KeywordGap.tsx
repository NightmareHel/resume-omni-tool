'use client';

import { KeywordGapResult } from '@/lib/claude';
import ScoreMeter from './ScoreMeter';

interface Props {
  result: KeywordGapResult;
}

function Chip({ text, variant }: { text: string; variant: 'found' | 'missing' | 'neutral' }) {
  const styles = {
    found: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    missing: 'bg-red-500/10 text-red-400 border border-red-500/20',
    neutral: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[variant]}`}>
      {text}
    </span>
  );
}

export default function KeywordGap({ result }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <ScoreMeter score={result.score} label="Keyword Match" />
        <div className="flex flex-col gap-2 justify-center">
          <h2 className="text-xl font-semibold text-zinc-100">Keyword Match Analysis</h2>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
            {result.score >= 80
              ? 'Strong keyword alignment. This resume will rank well for this role.'
              : result.score >= 60
              ? 'Moderate match. Adding the missing keywords below will significantly improve your ranking.'
              : 'Low keyword match. ATS filters may deprioritize this resume — add the missing must-have skills first.'}
          </p>
          <div className="flex gap-4 mt-1 text-sm">
            <span className="text-emerald-400">
              <span className="font-semibold">{result.found.length}</span> matched
            </span>
            <span className="text-red-400">
              <span className="font-semibold">{result.missing.length}</span> missing
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-300 mb-1">Must-Have Keywords</h3>
          <p className="text-xs text-zinc-500 mb-3">Explicitly required in the job description</p>
          <div className="flex flex-wrap gap-2">
            {result.mustHave.map((kw) => (
              <Chip key={kw} text={kw} variant={result.found.includes(kw) ? 'found' : 'missing'} />
            ))}
            {result.mustHave.length === 0 && (
              <span className="text-xs text-zinc-600">None identified</span>
            )}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-300 mb-1">Nice-to-Have Keywords</h3>
          <p className="text-xs text-zinc-500 mb-3">Preferred but not required</p>
          <div className="flex flex-wrap gap-2">
            {result.niceToHave.map((kw) => (
              <Chip key={kw} text={kw} variant={result.found.includes(kw) ? 'found' : 'neutral'} />
            ))}
            {result.niceToHave.length === 0 && (
              <span className="text-xs text-zinc-600">None identified</span>
            )}
          </div>
        </div>
      </div>

      {result.missing.length > 0 && (
        <div className="p-4 rounded-lg bg-zinc-900 border border-red-500/20">
          <h3 className="text-sm font-semibold text-red-400 mb-3">Missing Keywords — Placement Suggestions</h3>
          <div className="flex flex-col gap-3">
            {result.suggested.map((s) => (
              <div key={s.keyword} className="flex gap-3 text-sm">
                <span className="flex-shrink-0 font-mono text-red-400 font-medium min-w-[120px]">
                  {s.keyword}
                </span>
                <span className="text-zinc-400">{s.placement}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.found.length > 0 && (
        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Keywords Already Present</h3>
          <div className="flex flex-wrap gap-2">
            {result.found.map((kw) => (
              <Chip key={kw} text={kw} variant="found" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
