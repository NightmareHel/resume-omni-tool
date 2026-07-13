'use client';

export interface JobFiltersState {
  source: string;
  status: string;
  minScore: number;
  search: string;
  sort: string;
  hideBlocked: boolean;
  entryOnly: boolean;
  sponsorStatus: string;
}

interface Props {
  filters: JobFiltersState;
  onChange: (f: JobFiltersState) => void;
}

export default function JobFilters({ filters, onChange }: Props) {
  const set = <K extends keyof JobFiltersState>(k: K, v: JobFiltersState[K]) =>
    onChange({ ...filters, [k]: v });

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Source</label>
        <select
          className="bg-surface border border-seam text-graphite rounded-[8px] px-2 py-1.5 text-sm focus:outline-none focus:border-bronze"
          value={filters.source}
          onChange={(e) => set('source', e.target.value)}
        >
          <option value="">All</option>
          <option value="greenhouse">Greenhouse</option>
          <option value="lever">Lever</option>
          <option value="ashby">Ashby</option>
          <option value="workday">Workday</option>
          <option value="simplify">Simplify</option>
          <option value="themuse">The Muse</option>
          <option value="workable">Workable</option>
          <option value="smartrecruiters">SmartRecruiters</option>
          <option value="vanshb03">vanshb03 Feed</option>
          <option value="jobright">Jobright Feed</option>
          <option value="remotive">Remotive</option>
          <option value="remoteok">RemoteOK</option>
          <option value="jobicy">Jobicy</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Sponsor</label>
        <select
          className="bg-surface border border-seam text-graphite rounded-[8px] px-2 py-1.5 text-sm focus:outline-none focus:border-bronze"
          value={filters.sponsorStatus}
          onChange={(e) => set('sponsorStatus', e.target.value)}
        >
          <option value="">All</option>
          <option value="confirmed">Confirmed</option>
          <option value="likely">Likely</option>
          <option value="possible">Possible</option>
          <option value="unknown">Unknown</option>
          <option value="unlikely">Unlikely</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Status</label>
        <select
          className="bg-surface border border-seam text-graphite rounded-[8px] px-2 py-1.5 text-sm focus:outline-none focus:border-bronze"
          value={filters.status}
          onChange={(e) => set('status', e.target.value)}
        >
          <option value="">All</option>
          <option value="new">New</option>
          <option value="reviewed">Reviewed</option>
          <option value="queued">Queued</option>
          <option value="applied">Applied</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Sort</label>
        <select
          className="bg-surface border border-seam text-graphite rounded-[8px] px-2 py-1.5 text-sm focus:outline-none focus:border-bronze"
          value={filters.sort}
          onChange={(e) => set('sort', e.target.value)}
        >
          <option value="scraped_at">Newest First</option>
          <option value="score_desc">Score: High to Low</option>
          <option value="score_asc">Score: Low to High</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Min Score: {filters.minScore}</label>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={filters.minScore}
          onChange={(e) => set('minScore', parseInt(e.target.value, 10))}
          className="w-32 accent-[#8a7a5c]"
        />
      </div>

      <div className="flex flex-col gap-1 flex-1 min-w-48">
        <label className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Search</label>
        <input
          type="text"
          placeholder="Title or company..."
          className="bg-surface border border-seam text-graphite rounded-[8px] px-2 py-1.5 text-sm placeholder-faint focus:outline-none focus:border-bronze"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
        />
      </div>

      <div className="flex gap-3 items-center">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.hideBlocked}
            onChange={(e) => set('hideBlocked', e.target.checked)}
            className="accent-[#8a7a5c] w-4 h-4 rounded"
          />
          <span className="text-xs text-stone">Hide blocked</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filters.entryOnly}
            onChange={(e) => set('entryOnly', e.target.checked)}
            className="accent-[#8a7a5c] w-4 h-4 rounded"
          />
          <span className="text-xs text-stone">Entry only</span>
        </label>
      </div>
    </div>
  );
}
