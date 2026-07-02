export const TRANSITIONS: Record<string, string[]> = {
  draft:     ['pending', 'withdrawn'],
  pending:   ['submitted', 'withdrawn'],
  submitted: ['replied', 'rejected'],
  replied:   ['screen', 'rejected'],
  screen:    ['interview', 'rejected'],
  interview: ['offer', 'rejected'],
  offer:     ['withdrawn'],
  rejected:  [],
  withdrawn: [],
};

export const TERMINAL_STATUSES = new Set(['rejected', 'withdrawn']);
