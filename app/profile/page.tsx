'use client';

import { useEffect, useState } from 'react';
import ProfileEditor from '@/components/profile/ProfileEditor';


export default function ProfilePage() {
  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => { setInitial(d.profile); setLoading(false); })
      .catch(() => { setError('Failed to load profile. Refresh to retry.'); setLoading(false); });
  }, []);

  return (
    <main className="min-h-screen bg-zinc-900">
      <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-100">Master Profile</h1>
        <p className="text-zinc-400 text-sm mt-1">This is your source of truth. Used for all resume tailoring and job scoring.</p>
      </div>
      {loading ? (
        <p className="text-zinc-500 text-sm">Loading...</p>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <ProfileEditor initial={initial} />
      )}
      </div>
    </main>
  );
}
