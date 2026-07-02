import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { applications, profile } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { generateResumePDF } from '@/lib/resume-pdf';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [app] = await db.select().from(applications).where(eq(applications.id, id));
  if (!app) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  }
  if (!app.resume_text) {
    return new Response(JSON.stringify({ error: 'No resume text on this application' }), { status: 400 });
  }

  const [prof] = await db.select().from(profile).where(eq(profile.id, 'default'));
  if (!prof) {
    return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 400 });
  }

  const pdfBuffer = await generateResumePDF(app.resume_text, prof);
  const pdf = new Uint8Array(pdfBuffer);

  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="resume-${id.slice(0, 8)}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    },
  });
}
