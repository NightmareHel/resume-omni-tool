'use client';

// Left-rail step indicator: mono numerals on a vertical spine (horizontal on
// mobile). Same API as the old centered version.

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
    <nav className="flex lg:flex-col gap-0 lg:gap-0" aria-label="Wizard steps">
      {STEPS.map((step, i) => {
        const done = step.n < current;
        const active = step.n === current;
        return (
          <div key={step.n} className="flex lg:flex-col items-center lg:items-start flex-1 lg:flex-none">
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-semibold border transition-all duration-300 flex-shrink-0 ${
                  done || active
                    ? 'bg-graphite border-bronze text-white'
                    : 'bg-surface border-seam text-faint'
                }`}
              >
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7l3.5 3.5L12 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  String(step.n).padStart(2, '0')
                )}
              </div>
              <span
                className={`hidden lg:inline font-mono text-[11px] uppercase tracking-[0.14em] whitespace-nowrap ${
                  active ? 'text-bronze-strong' : done ? 'text-stone' : 'text-faint'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <>
                {/* horizontal connector (mobile) */}
                <div className={`lg:hidden h-px flex-1 mx-2 transition-all duration-300 ${done ? 'bg-bronze/50' : 'bg-seam'}`} />
                {/* vertical spine (desktop) */}
                <div className={`hidden lg:block w-px h-8 ml-4 my-1 transition-all duration-300 ${done ? 'bg-bronze/50' : 'bg-seam'}`} />
              </>
            )}
          </div>
        );
      })}
    </nav>
  );
}
