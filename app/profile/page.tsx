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
    <main className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-graphite">Master Profile</h1>
          <p className="text-stone text-sm mt-1">Source of truth for resume tailoring and job scoring.</p>
        </div>
        {loading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-sunken rounded-[14px] animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4 bg-red-600/10 ring-1 ring-red-600/25 rounded-[14px] text-red-800 text-sm">{error}</div>
        ) : (
          <ProfileEditor initial={initial} />
        )}
      </div>
    </main>
  );
}
