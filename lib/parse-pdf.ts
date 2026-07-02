// pdf-parse is CJS-only; require avoids ESM default-export issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (
  buf: Buffer
) => Promise<{ text: string; numpages: number }>;

export interface PDFParseResult {
  text: string;
  pageCount: number;
}

export async function parsePDF(buffer: Buffer): Promise<PDFParseResult> {
  const data = await pdfParse(buffer);
  return {
    text: data.text,
    pageCount: data.numpages,
  };
}
