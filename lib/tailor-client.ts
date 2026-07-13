// Client-side consumer for POST /api/jobs/[id]/tailor (SSE stream).
// Shared by the single-job Tailor button (jobs page) and the batch queue (JobBoard).

export type TailorResult = { ok: true } | { ok: false; error: string; status?: number };

export async function tailorJob(jobId: string, onProgress?: (label: string) => void): Promise<TailorResult> {
  const res = await fetch(`/api/jobs/${jobId}/tailor`, { method: 'POST' });

  // Pre-check failures (404/400/409) come back as plain JSON
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    return {
      ok: false,
      error: (body as { error?: string }).error ?? `Tailoring failed (${res.status}). Check your profile and AI key.`,
      status: res.status,
    };
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

  if (failed) return { ok: false, error: failed };
  if (finished) return { ok: true };
  return { ok: false, error: 'Tailoring failed: stream ended unexpectedly' };
}
