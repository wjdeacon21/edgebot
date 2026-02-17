import { ContentChunk, StructuredFact } from "@/types";

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: [text],
      model: "voyage-3",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voyage AI embedding failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

export async function generateResponse(params: {
  rawEmail: string;
  topChunks: ContentChunk[];
  structuredFacts: StructuredFact[];
  conflictFlag: boolean;
}): Promise<{
  internalSummary: string;
  suggestedReply: string;
  confidence: string;
  conflicts: string[];
}> {
  // TODO: Implement in task 1.4.1
  throw new Error("Not implemented");
}
