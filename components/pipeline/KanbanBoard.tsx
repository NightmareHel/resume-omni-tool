'use client';

import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import ApplicationCard from './ApplicationCard';
import { STATUS_DOT } from '@/lib/ui';

interface Application {
  id: string;
  job_id: string;
  status: string;
  resume_text: string | null;
  cover_letter: string | null;
  keyword_gap: string | null;
  notes: string | null;
  created_at: string;
  applied_at: string | null;
}

interface Job {
  id: string;
  title: string;
  company: string;
  source: string;
  url: string;
  sponsor_status?: string | null;
  sponsor_evidence?: string | null;
  sponsor_lca_count?: number | null;
}

interface Props {
  applications: Application[];
  jobs: Record<string, Job>;
  onStatusChange: (id: string, status: string, notes?: string) => void;
  onApprove: (id: string) => void;
  onRemove: (id: string) => void;
}

const COLUMNS = ['draft', 'pending', 'submitted', 'replied', 'screen', 'interview', 'offer', 'rejected', 'withdrawn'];

export default function KanbanBoard({ applications, jobs, onStatusChange, onApprove, onRemove }: Props) {
  const byStatus: Record<string, Application[]> = {};
  for (const col of COLUMNS) byStatus[col] = [];
  for (const app of applications) {
    if (byStatus[app.status]) byStatus[app.status].push(app);
    else byStatus['draft']?.push(app);
  }

  const nonEmpty = COLUMNS.filter((c) => byStatus[c].length > 0 || ['draft', 'pending', 'submitted'].includes(c));

  const spring = { type: 'spring' as const, stiffness: 400, damping: 35 };

  return (
    <LayoutGroup>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {nonEmpty.map((col) => (
          <div key={col} className="flex-shrink-0 w-64 bg-sunken rounded-[14px] p-2">
            <div className="flex items-center gap-2 px-1.5 py-2">
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT[col] ?? 'bg-stone-400'}`} />
              <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
                {col.replace('_', ' ')} <span className="text-faint tabular-nums">({byStatus[col].length})</span>
              </h3>
            </div>
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {byStatus[col].map((app) => (
                  <motion.div
                    key={app.id}
                    layoutId={app.id}
                    layout
                    transition={spring}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                  >
                    <ApplicationCard
                      application={app}
                      job={jobs[app.job_id] ?? null}
                      onStatusChange={onStatusChange}
                      onApprove={onApprove}
                      onRemove={onRemove}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              {byStatus[col].length === 0 && (
                <p className="text-faint text-xs px-1.5 pb-1">Empty</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </LayoutGroup>
  );
}
