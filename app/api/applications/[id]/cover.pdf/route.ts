import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { applications, profile } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { generateCoverLetterPDF } from '@/lib/resume-pdf';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const [app] = await db.select().from(applications).where(eq(applications.id, id));
  if (!app) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  if (!app.cover_letter) {
    return new Response(JSON.stringify({ error: 'No cover letter on this application' }), { status: 400 });
  }

  const [prof] = await db.select().from(profile).where(eq(profile.id, 'default'));
  if (!prof) return new Response(JSON.stringify({ error: 'Profile not found' }), { status: 400 });

  try {
    const pdfBuffer = await generateCoverLetterPDF(app.cover_letter, prof);

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="cover-${id.slice(0, 8)}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error('Cover letter PDF generation failed:', err);
    return new Response(JSON.stringify({ error: 'PDF generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
