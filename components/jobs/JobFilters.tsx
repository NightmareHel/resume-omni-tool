'use client';

export interface JobFiltersState {
  source: string;
  status: string;
  minScore: number;
  search: string;
  sort: string;
}

interface Props {
  filters: JobFiltersState;
  onChange: (f: JobFiltersState) => void;
}

export default function JobFilters({ filters, onChange }: Props) {
  const set = (k: keyof JobFiltersState, v: string | number) =>
    onChange({ ...filters, [k]: v });

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-400 uppercase tracking-wide">Source</label>
        <select
          className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded px-2 py-1.5 text-sm"
          value={filters.source}
          onChange={(e) => set('source', e.target.value)}
        >
          <option value="">All</option>
          <option value="greenhouse">Greenhouse</option>
          <option value="lever">Lever</option>
          <option value="ashby">Ashby</option>
          <option value="workday">Workday</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-400 uppercase tracking-wide">Status</label>
        <select
          className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded px-2 py-1.5 text-sm"
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
        <label className="text-xs text-zinc-400 uppercase tracking-wide">Sort</label>
        <select
          className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded px-2 py-1.5 text-sm"
          value={filters.sort}
          onChange={(e) => set('sort', e.target.value)}
        >
          <option value="scraped_at">Newest First</option>
          <option value="score_desc">Score: High to Low</option>
          <option value="score_asc">Score: Low to High</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-400 uppercase tracking-wide">Min Score: {filters.minScore}</label>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={filters.minScore}
          onChange={(e) => set('minScore', parseInt(e.target.value, 10))}
          className="w-32 accent-emerald-500"
        />
      </div>

      <div className="flex flex-col gap-1 flex-1 min-w-48">
        <label className="text-xs text-zinc-400 uppercase tracking-wide">Search</label>
        <input
          type="text"
          placeholder="Title or company..."
          className="bg-zinc-800 border border-zinc-700 text-zinc-100 rounded px-2 py-1.5 text-sm placeholder-zinc-500"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
        />
      </div>
    </div>
  );
}
