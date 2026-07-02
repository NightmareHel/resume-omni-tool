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

    // Reload threads
    const fresh = await fetch('/api/emails').then((r) => r.json());
    setThreads(fresh.threads ?? []);
  };

  return (
    <main className="min-h-screen bg-zinc-900">
      <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Email Inbox</h1>
          <p className="text-zinc-400 text-sm mt-1">{threads.length} threads synced</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          {syncNote && <p className="text-zinc-500 text-xs max-w-64 text-right">{syncNote}</p>}
        </div>
      </div>
      {loading ? (
        <p className="text-zinc-500 text-sm">Loading...</p>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <EmailInbox threads={threads} />
      )}
      </div>
    </main>
  );
}
