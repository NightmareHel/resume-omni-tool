'use client';

import { useRouter } from 'next/navigation';
import JobBoard from '@/components/jobs/JobBoard';
import ManualJobsSection from '@/components/jobs/ManualJobsSection';
import { useToast } from '@/lib/toast';
import { tailorJob } from '@/lib/tailor-client';


export default function JobsPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const handleTailor = async (jobId: string, onProgress?: (label: string) => void) => {
    const result = await tailorJob(jobId, onProgress);
    if (result.ok) {
      router.push('/pipeline?tailored=true');
    } else {
      addToast(result.error, 'error');
    }
  };

  return (
    <main className="min-h-screen">
      <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto w-full">
        <ManualJobsSection onTailor={handleTailor} />
        <JobBoard onTailor={handleTailor} />
      </div>
    </main>
  );
}
