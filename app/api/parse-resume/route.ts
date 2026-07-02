import { NextRequest, NextResponse } from 'next/server';
import { parsePDF } from '@/lib/parse-pdf';
import { parseDOCX } from '@/lib/parse-docx';
import { runATSAudit } from '@/lib/ats-rules';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const text = formData.get('text') as string | null;

  let parsedText = '';
  let hasTables = false;
  let hasMultiColumn = false;
  let hasHeaderFooter = false;
  let fileType: 'pdf' | 'docx' | 'text' = 'text';

  if (file && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();

    if (name.endsWith('.pdf')) {
      fileType = 'pdf';
      const result = await parsePDF(buffer);
      parsedText = result.text;
    } else if (name.endsWith('.docx') || name.endsWith('.doc')) {
      fileType = 'docx';
      const result = await parseDOCX(buffer);
      parsedText = result.text;
      hasTables = result.hasTables;
      hasMultiColumn = result.hasMultiColumn;
      hasHeaderFooter = result.hasHeaderFooter;
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload a PDF or DOCX file.' },
        { status: 400 }
      );
    }
  } else if (text && text.trim().length > 0) {
    parsedText = text.trim();
    fileType = 'text';
  } else {
    return NextResponse.json(
      { error: 'No file or text provided.' },
      { status: 400 }
    );
  }

  const atsResult = runATSAudit({ text: parsedText, hasTables, hasMultiColumn, hasHeaderFooter, fileType });

  return NextResponse.json({ text: parsedText, atsResult });
}
