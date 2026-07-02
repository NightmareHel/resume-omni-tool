import { NextRequest, NextResponse } from 'next/server';
import { analyzeKeywordGap } from '@/lib/claude';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { resumeText, jdText } = body as { resumeText?: string; jdText?: string };

  if (!resumeText?.trim() || !jdText?.trim()) {
    return NextResponse.json(
      { error: 'Both resumeText and jdText are required.' },
      { status: 400 }
    );
  }

  let result: Awaited<ReturnType<typeof analyzeKeywordGap>>;
  try {
    result = await analyzeKeywordGap(resumeText, jdText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Analysis failed: ${msg}` }, { status: 502 });
  }
  return NextResponse.json(result);
}
