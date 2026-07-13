'use client';

interface Props {
  score: number;
  label?: string;
}

function getColor(score: number): string {
  if (score >= 80) return '#15803d'; // green-700
  if (score >= 60) return '#f59e0b'; // amber-500
  return '#ef4444'; // red-500
}

function getLabel(score: number): string {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Needs Work';
  return 'High Risk';
}

export default function ScoreMeter({ score, label }: Props) {
  const color = getColor(score);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#27272a" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="70" y="66" textAnchor="middle" fill="white" fontSize="28" fontWeight="700" fontFamily="inherit">
          {score}
        </text>
        <text x="70" y="84" textAnchor="middle" fill="#a1a1aa" fontSize="11" fontFamily="inherit">
          / 100
        </text>
      </svg>
      <span style={{ color }} className="text-sm font-semibold tracking-wide uppercase">
        {label ?? getLabel(score)}
      </span>
    </div>
  );
}
