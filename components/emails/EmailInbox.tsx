'use client';
import { CLASS_COLORS } from '@/lib/ui';

interface EmailThread {
  id: string;
  application_id: string | null;
  job_id: string | null;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  received_at: string;
  snippet: string | null;
  classification: string;
  action_required: number | null;
  read: number | null;
}

interface Props {
  threads: EmailThread[];
}

export default function EmailInbox({ threads }: Props) {
  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-stone">
        <p className="text-sm">No email threads synced yet.</p>
        <p className="text-xs">Start the email sync worker or trigger a manual sync.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {threads.map((t) => (
        <div key={t.id} className={`bg-surface border rounded-[14px] shadow-card p-4 flex flex-col gap-2 ${t.action_required ? 'border-amber-700' : 'border-seam'}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-graphite text-sm font-medium truncate">{t.subject ?? '(no subject)'}</p>
              <p className="text-stone text-xs">{t.from_name ?? t.from_email ?? 'Unknown'}</p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${CLASS_COLORS[t.classification] ?? CLASS_COLORS.other}`}>
                {t.classification}
              </span>
              {t.action_required === 1 && (
                <span className="text-xs bg-amber-900 text-amber-300 px-1.5 py-0.5 rounded">Action needed</span>
              )}
            </div>
          </div>

          {t.snippet && <p className="text-stone text-xs leading-relaxed">{t.snippet}</p>}

          <div className="flex items-center gap-3 text-xs text-faint">
            <span>{new Date(t.received_at).toLocaleDateString()}</span>
            {t.application_id && <span className="text-stone">Linked to application</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
