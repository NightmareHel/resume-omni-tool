'use client';

const STEPS = [
  { n: 1, label: 'Resume' },
  { n: 2, label: 'ATS Audit' },
  { n: 3, label: 'Job Match' },
  { n: 4, label: 'Rewrite' },
];

interface Props {
  current: number;
}

export default function StepIndicator({ current }: Props) {
  return (
    <div className="flex items-center gap-0 w-full max-w-xl mx-auto">
      {STEPS.map((step, i) => {
        const done = step.n < current;
        const active = step.n === current;
        return (
          <div key={step.n} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-300 ${
                  done
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : active
                    ? 'bg-violet-600 border-violet-600 text-white'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-500'
                }`}
              >
                {done ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7l3.5 3.5L12 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  step.n
                )}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium whitespace-nowrap ${
                  active ? 'text-violet-400' : done ? 'text-zinc-400' : 'text-zinc-600'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 mb-4 transition-all duration-300 ${
                  done ? 'bg-violet-600' : 'bg-zinc-800'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
