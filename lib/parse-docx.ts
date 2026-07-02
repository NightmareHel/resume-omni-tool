import mammoth from 'mammoth';

export interface DocxParseResult {
  text: string;
  html: string;
  hasTables: boolean;
  hasMultiColumn: boolean;
  hasHeaderFooter: boolean;
  warnings: string[];
}

export async function parseDOCX(buffer: Buffer): Promise<DocxParseResult> {
  const [textResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    mammoth.convertToHtml({ buffer }),
  ]);

  const html = htmlResult.value;
  const allMessages = [
    ...textResult.messages.map((m) => m.message),
    ...htmlResult.messages.map((m) => m.message),
  ];

  const lower = allMessages.map((m) => m.toLowerCase());

  return {
    text: textResult.value,
    html,
    hasTables: /<table/i.test(html),
    hasMultiColumn: lower.some((m) => m.includes('text box') || m.includes('column')),
    hasHeaderFooter: lower.some((m) => m.includes('header') || m.includes('footer')),
    warnings: allMessages,
  };
}
