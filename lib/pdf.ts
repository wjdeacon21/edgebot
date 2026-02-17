export async function extractTextFromPdf(
  buffer: Buffer
): Promise<{ pages: { pageNumber: number; text: string }[] }> {
  // Dynamic import to avoid worker issues at module load time
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Point worker to the actual worker file
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  const uint8Array = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({
    data: uint8Array,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const pages: { pageNumber: number; text: string }[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();

    let lastY: number | null = null;
    const lines: string[] = [];
    let currentLine = "";

    for (const item of textContent.items) {
      if (!("str" in item)) continue;
      const y = (item as { transform: number[] }).transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(currentLine.trim());
        currentLine = "";
      }
      currentLine += item.str;
      lastY = y;
    }
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }

    const text = lines.filter(Boolean).join("\n");
    if (text) {
      pages.push({ pageNumber: i, text });
    }
  }

  await doc.destroy();
  return { pages };
}
