'use client';

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

const CLASS_COLORS: Record<string, string> = {
  reply:      'bg-blue-900 text-blue-200',
  rejection:  'bg-red-900 text-red-300',
  interview:  'bg-emerald-900 text-emerald-200',
  offer:      'bg-amber-800 text-amber-200',
  other:      'bg-zinc-700 text-zinc-400',
};

export default function EmailInbox({ threads }: Props) {
  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-zinc-500">
        <p className="text-sm">No email threads synced yet.</p>
        <p className="text-xs">Start the email sync worker or trigger a manual sync.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {threads.map((t) => (
        <div key={t.id} className={`bg-zinc-800 border rounded-xl p-4 flex flex-col gap-2 ${t.action_required ? 'border-amber-700' : 'border-zinc-700'}`}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-zinc-100 text-sm font-medium truncate">{t.subject ?? '(no subject)'}</p>
              <p className="text-zinc-400 text-xs">{t.from_name ?? t.from_email ?? 'Unknown'}</p>
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

          {t.snippet && <p className="text-zinc-500 text-xs leading-relaxed">{t.snippet}</p>}

          <div className="flex items-center gap-3 text-xs text-zinc-600">
            <span>{new Date(t.received_at).toLocaleDateString()}</span>
            {t.application_id && <span className="text-zinc-500">Linked to application</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
