'use client';

import { ATSResult, ATSCheck } from '@/lib/ats-rules';
import ScoreMeter from './ScoreMeter';

interface Props {
  result: ATSResult;
}

const STATUS_STYLES: Record<ATSCheck['status'], { badge: string; icon: string }> = {
  pass: {
    badge: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    icon: '✓',
  },
  fail: {
    badge: 'bg-red-500/10 text-red-400 border border-red-500/20',
    icon: '✗',
  },
  warn: {
    badge: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    icon: '!',
  },
  unknown: {
    badge: 'bg-zinc-700 text-zinc-400',
    icon: '?',
  },
};

const IMPACT_DOT: Record<ATSCheck['impact'], string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-zinc-500',
};

export default function ATSAudit({ result }: Props) {
  const fails = result.checks.filter((c) => c.status === 'fail').length;
  const warns = result.checks.filter((c) => c.status === 'warn').length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <ScoreMeter score={result.score} />
        <div className="flex flex-col gap-2 justify-center">
          <h2 className="text-xl font-semibold text-zinc-100">ATS Compatibility Score</h2>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-md">
            {result.score >= 80
              ? 'Strong ATS compatibility. Your resume is well-structured for automated parsing.'
              : result.score >= 60
              ? 'Moderate compatibility. Address the failed checks below before submitting.'
              : 'High risk of parsing failure. Fix the critical issues below first.'}
          </p>
          <div className="flex gap-4 mt-1">
            {fails > 0 && (
              <span className="text-sm text-red-400">
                <span className="font-semibold">{fails}</span> failed
              </span>
            )}
            {warns > 0 && (
              <span className="text-sm text-amber-400">
                <span className="font-semibold">{warns}</span> warnings
              </span>
            )}
            <span className="text-sm text-emerald-400">
              <span className="font-semibold">{result.checks.filter((c) => c.status === 'pass').length}</span> passed
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {result.checks.map((check) => {
          const styles = STATUS_STYLES[check.status];
          return (
            <div
              key={check.id}
              className="flex items-start gap-3 p-3.5 rounded-lg bg-zinc-900 border border-zinc-800"
            >
              <span
                className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${styles.badge}`}
              >
                {styles.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-zinc-200">{check.name}</span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${IMPACT_DOT[check.impact]}`}
                    title={`${check.impact} impact`}
                  />
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{check.message}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> High impact
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Medium impact
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" /> Low impact
        </span>
      </div>
    </div>
  );
}
