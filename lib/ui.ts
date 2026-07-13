// Quartz & Marble semantic color maps — single source of truth for every
// status/badge tint in the app. Light-theme recipe: `bg-{hue}/10 text-{hue}-800
// ring-1 ring-{hue}/25`. These are DATA ENCODING, not decoration — the one
// decorative accent is stone bronze (--accent), used nowhere below.

export const EASE = [0.16, 1, 0.3, 1] as const;

// Sponsorship verdicts (jobs.sponsor_status)
export const SPONSOR_BADGE: Record<string, string> = {
  confirmed: 'bg-green-700/10 text-green-800 ring-1 ring-green-700/25',
  likely:    'bg-green-700/8 text-green-700 ring-1 ring-green-700/20',
  possible:  'bg-amber-600/10 text-amber-800 ring-1 ring-amber-600/25',
  unknown:   'bg-sunken text-stone ring-1 ring-seam',
  unlikely:  'bg-orange-600/10 text-orange-800 ring-1 ring-orange-600/25',
  blocked:   'bg-red-600/10 text-red-800 ring-1 ring-red-600/25',
};

export const SPONSOR_LABEL: Record<string, string> = {
  confirmed: 'Sponsors', likely: 'Likely Sponsors', possible: 'Possible Sponsor',
  unknown: 'Unknown Sponsorship', unlikely: 'Unlikely to Sponsor', blocked: 'No Sponsorship',
};

// Application status chips
export const STATUS_COLORS: Record<string, string> = {
  draft:           'bg-sunken text-stone ring-1 ring-seam',
  pending:         'bg-amber-600/10 text-amber-800 ring-1 ring-amber-600/25',
  submitted:       'bg-blue-600/10 text-blue-800 ring-1 ring-blue-600/25',
  replied:         'bg-violet-600/10 text-violet-800 ring-1 ring-violet-600/25',
  screen:          'bg-cyan-600/10 text-cyan-800 ring-1 ring-cyan-600/25',
  interview:       'bg-indigo-600/10 text-indigo-800 ring-1 ring-indigo-600/25',
  offer:           'bg-green-700/10 text-green-800 ring-1 ring-green-700/25',
  rejected:        'bg-red-600/10 text-red-800 ring-1 ring-red-600/25',
  withdrawn:       'bg-sunken text-faint ring-1 ring-hairline',
  manual_required: 'bg-orange-600/10 text-orange-800 ring-1 ring-orange-600/25',
};

// Solid dots for kanban column headers + funnel stages
export const STATUS_DOT: Record<string, string> = {
  draft:           'bg-stone-400',
  pending:         'bg-amber-500',
  submitted:       'bg-blue-500',
  replied:         'bg-violet-500',
  screen:          'bg-cyan-500',
  interview:       'bg-indigo-500',
  offer:           'bg-green-600',
  rejected:        'bg-red-500',
  withdrawn:       'bg-stone-300',
  manual_required: 'bg-orange-500',
};

// Fit score → text color / badge classes
export function scoreText(score: number): string {
  return score >= 75 ? 'text-green-700' : score >= 55 ? 'text-amber-700' : 'text-red-700';
}
export function scoreBadge(score: number): string {
  return score >= 75
    ? 'bg-green-700/10 text-green-800 ring-1 ring-green-700/25'
    : score >= 55
      ? 'bg-amber-600/10 text-amber-800 ring-1 ring-amber-600/25'
      : 'bg-red-600/10 text-red-800 ring-1 ring-red-600/25';
}

// Job board statuses (jobs.status — distinct from application statuses)
export const JOB_STATUS_COLORS: Record<string, string> = {
  new:      'bg-sunken text-graphite ring-1 ring-seam',
  reviewed: 'bg-blue-600/10 text-blue-800 ring-1 ring-blue-600/25',
  queued:   'bg-amber-600/10 text-amber-800 ring-1 ring-amber-600/25',
  applied:  'bg-green-700/10 text-green-800 ring-1 ring-green-700/25',
  archived: 'bg-sunken text-faint ring-1 ring-hairline',
};

export const SOURCE_LABELS: Record<string, string> = {
  greenhouse: 'GH', lever: 'LV', ashby: 'AS', workday: 'WD', custom: 'CX',
  simplify: 'SJ', workable: 'WK', themuse: 'MU', smartrecruiters: 'SR',
  vanshb03: 'VB', jobright: 'JR', remotive: 'RM', remoteok: 'RO', jobicy: 'JC',
};

// Critique severity blocks
export const SEVERITY_COLORS: Record<string, string> = {
  high:   'text-red-800 bg-red-600/10 border-red-600/25',
  medium: 'text-amber-800 bg-amber-600/10 border-amber-600/25',
  low:    'text-stone bg-sunken border-seam',
};

// Email thread classification
export const CLASS_COLORS: Record<string, string> = {
  reply:     'bg-blue-600/10 text-blue-800 ring-1 ring-blue-600/25',
  rejection: 'bg-red-600/10 text-red-800 ring-1 ring-red-600/25',
  interview: 'bg-green-700/10 text-green-800 ring-1 ring-green-700/25',
  offer:     'bg-amber-600/10 text-amber-800 ring-1 ring-amber-600/25',
  other:     'bg-sunken text-stone ring-1 ring-seam',
};

// Shared button recipes
export const BTN = {
  primary:   'bg-graphite text-white hover:bg-black active:scale-[0.98] rounded-[8px] transition-all',
  secondary: 'bg-surface border border-seam text-graphite hover:border-bronze rounded-[8px] transition-colors',
  ghost:     'text-stone hover:text-graphite transition-colors',
} as const;

// Mono metadata label (the portfolio signature)
export const MONO_LABEL = 'font-mono text-[11px] uppercase tracking-[0.14em] text-faint';
