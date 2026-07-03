'use client';

import { useRouter } from 'next/navigation';
import JobBoard from '@/components/jobs/JobBoard';
import ManualJobsSection from '@/components/jobs/ManualJobsSection';
import { useToast } from '@/lib/toast';


export default function JobsPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const handleTailor = async (jobId: string, onProgress?: (label: string) => void) => {
    const res = await fetch(`/api/jobs/${jobId}/tailor`, { method: 'POST' });

    // Pre-check failures (404/400/409) come back as plain JSON
    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      addToast((body as { error?: string }).error ?? `Tailoring failed (${res.status}). Check your profile and AI key.`, 'error');
      return;
    }

    // Success path is an SSE stream: stage events, cover letter deltas, then done/error
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let stagesDone = 0;
    let failed: string | null = null;
    let finished = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const raw of events) {
        const line = raw.trim();
        if (!line.startsWith('data: ')) continue;
        let evt: { type: string; stage?: string; error?: string };
        try { evt = JSON.parse(line.slice(6)); } catch { continue; }
        if (evt.type === 'stage') {
          stagesDone += 1;
          onProgress?.(`Tailoring ${stagesDone}/3...`);
        } else if (evt.type === 'error') {
          failed = evt.error ?? 'AI rewrite failed';
        } else if (evt.type === 'done') {
          finished = true;
        }
      }
    }

    if (failed) {
      addToast(failed, 'error');
    } else if (finished) {
      router.push('/pipeline?tailored=true');
    } else {
      addToast('Tailoring failed: stream ended unexpectedly', 'error');
    }
  };

  return (
    <main className="min-h-screen bg-zinc-900">
      <div className="p-6 flex flex-col gap-10">
        <ManualJobsSection onTailor={handleTailor} />
        <hr className="border-zinc-700" />
        <JobBoard onTailor={handleTailor} />
      </div>
    </main>
  );
}
