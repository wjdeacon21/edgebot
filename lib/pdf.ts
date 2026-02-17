import { PDFParse } from "pdf-parse";

export async function extractTextFromPdf(
  buffer: Buffer
): Promise<{ pages: { pageNumber: number; text: string }[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parser = new PDFParse({ verbosity: 0 }) as any;
  await parser.load(buffer);
  const result = await parser.getText();

  const pages: { pageNumber: number; text: string }[] = [];

  for (const page of result.pages) {
    const text = page.text.trim();
    if (text) {
      pages.push({ pageNumber: page.pageNumber, text });
    }
  }

  return { pages };
}
