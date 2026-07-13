'use client';

import { useEffect, useState } from 'react';
import EmailInbox from '@/components/emails/EmailInbox';

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

export default function EmailsPage() {
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncNote, setSyncNote] = useState('');

  useEffect(() => {
    fetch('/api/emails')
      .then((r) => r.json())
      .then((d) => { setThreads(d.threads ?? []); setLoading(false); })
      .catch(() => { setError('Failed to load emails. Refresh to retry.'); setLoading(false); });
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncNote('');
    const res = await fetch('/api/emails/sync', { method: 'POST' });
    const data = await res.json();
    setSyncNote(data.note ?? `Found ${data.found}, matched ${data.matched}`);
    setSyncing(false);
    const fresh = await fetch('/api/emails').then((r) => r.json());
    setThreads(fresh.threads ?? []);
  };

  return (
    <main className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-graphite">Email Inbox</h1>
            <p className="text-stone text-sm mt-1 tabular-nums">{threads.length} threads synced</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="bg-surface border border-seam text-graphite hover:border-bronze transition-colors text-sm px-4 py-2 rounded-[8px] disabled:opacity-50 transition-colors"
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            {syncNote && <p className="text-stone text-xs max-w-64 text-right">{syncNote}</p>}
          </div>
        </div>
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-sunken rounded-[14px] animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 bg-red-600/10 ring-1 ring-red-600/25 rounded-[14px] text-red-800 text-sm">{error}</div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="w-10 h-10 rounded-full bg-sunken flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="4" width="14" height="11" rx="2" stroke="#52525b" strokeWidth="1.5" />
                <path d="M2 7l7 5 7-5" stroke="#52525b" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-stone text-sm">No emails synced yet.</p>
            <p className="text-faint text-xs">Click Sync Now to pull from Gmail.</p>
          </div>
        ) : (
          <EmailInbox threads={threads} />
        )}
      </div>
    </main>
  );
}
