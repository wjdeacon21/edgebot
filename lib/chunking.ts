interface PageInput {
  pageNumber: number;
  text: string;
}

interface Chunk {
  pageNumber: number;
  sectionHeading: string | null;
  text: string;
}

const MIN_CHUNK_TOKENS = 400;
const MAX_CHUNK_TOKENS = 800;

function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 100) return false;
  // All caps line (at least 3 chars)
  if (trimmed.length >= 3 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) return true;
  // Short line before a paragraph (detected by caller)
  return false;
}

function splitIntoSentences(text: string): string[] {
  // Split on sentence boundaries, keeping the delimiter
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.filter((p) => p.trim().length > 0);
}

export function chunkPages(pages: PageInput[]): Chunk[] {
  const chunks: Chunk[] = [];

  for (const page of pages) {
    const lines = page.text.split("\n");
    let currentHeading: string | null = null;
    let currentText = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (isHeading(line)) {
        // Flush current chunk if it has content
        if (currentText.trim() && estimateTokens(currentText) >= MIN_CHUNK_TOKENS) {
          chunks.push({
            pageNumber: page.pageNumber,
            sectionHeading: currentHeading,
            text: currentText.trim(),
          });
          currentText = "";
        }
        currentHeading = line.trim();
        continue;
      }

      currentText += (currentText ? "\n" : "") + line;

      // If we've exceeded max tokens, split and flush
      if (estimateTokens(currentText) >= MAX_CHUNK_TOKENS) {
        const sentences = splitIntoSentences(currentText);
        let chunk = "";

        for (const sentence of sentences) {
          const candidate = chunk ? chunk + " " + sentence : sentence;
          if (estimateTokens(candidate) > MAX_CHUNK_TOKENS && chunk) {
            chunks.push({
              pageNumber: page.pageNumber,
              sectionHeading: currentHeading,
              text: chunk.trim(),
            });
            chunk = sentence;
          } else {
            chunk = candidate;
          }
        }

        currentText = chunk;
      }
    }

    // Flush remaining text for this page
    if (currentText.trim()) {
      // If the remaining text is too small and we have a previous chunk from this page,
      // merge it with the last chunk if combined size is within limits
      const lastChunk = chunks[chunks.length - 1];
      if (
        lastChunk &&
        lastChunk.pageNumber === page.pageNumber &&
        estimateTokens(currentText) < MIN_CHUNK_TOKENS &&
        estimateTokens(lastChunk.text + "\n" + currentText) <= MAX_CHUNK_TOKENS
      ) {
        lastChunk.text += "\n" + currentText.trim();
      } else {
        chunks.push({
          pageNumber: page.pageNumber,
          sectionHeading: currentHeading,
          text: currentText.trim(),
        });
      }
    }
  }

  return chunks;
}
