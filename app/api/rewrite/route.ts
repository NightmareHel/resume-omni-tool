import { NextRequest, NextResponse } from 'next/server';
import { rewriteResume } from '@/lib/claude';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { resumeText, jdText } = body as { resumeText?: string; jdText?: string };

  if (!resumeText?.trim() || !jdText?.trim()) {
    return NextResponse.json(
      { error: 'Both resumeText and jdText are required.' },
      { status: 400 }
    );
  }

  const result = await rewriteResume(resumeText, jdText);
  return NextResponse.json(result);
}
