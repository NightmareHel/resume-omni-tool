'use client';

import { useRouter } from 'next/navigation';
import JobBoard from '@/components/jobs/JobBoard';
import { useToast } from '@/lib/toast';


export default function JobsPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const handleTailor = async (jobId: string) => {
    const res = await fetch(`/api/jobs/${jobId}/tailor`, { method: 'POST' });
    if (res.ok) {
      router.push('/pipeline?tailored=true');
    } else {
      const body = await res.json().catch(() => ({}));
      addToast((body as { error?: string }).error ?? `Tailoring failed (${res.status}). Check your profile and GROQ_API_KEY.`, 'error');
    }
  };

  return (
    <main className="min-h-screen bg-zinc-900">
      <div className="p-6">
        <JobBoard onTailor={handleTailor} />
      </div>
    </main>
  );
}
