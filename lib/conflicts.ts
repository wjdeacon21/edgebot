import Anthropic from "@anthropic-ai/sdk";
import { ContentChunk, StructuredFact } from "@/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function detectConflicts(
  chunks: ContentChunk[],
  facts: StructuredFact[]
): Promise<{
  conflictFlag: boolean;
  conflicts: string[];
  confidence: "high" | "medium" | "low";
}> {
  // If no data to compare, return high confidence with no conflicts
  if (chunks.length === 0 && facts.length === 0) {
    return { conflictFlag: false, conflicts: [], confidence: "low" };
  }

  const chunksText = chunks
    .map(
      (c, i) =>
        `[Chunk ${i + 1} | source_type: ${c.source_type} | page: ${c.page_number}]\n${c.text}`
    )
    .join("\n\n");

  const factsText = facts
    .map(
      (f, i) =>
        `[Fact ${i + 1} | category: ${f.category} | confidence: ${f.confidence}]\n${f.key}: ${f.value} (source: ${f.source_document || "unknown"}, page: ${f.page_number ?? "N/A"})`
    )
    .join("\n\n");

  const prompt = `You are a conflict detection system. Given these text chunks and structured facts, identify any contradictions in factual claims (dates, prices, policies, locations, times, etc.).

TEXT CHUNKS:
${chunksText}

STRUCTURED FACTS:
${factsText || "None provided."}

Return a JSON object with exactly this format:
{"conflicts": ["description of conflict 1", "description of conflict 2"], "hasConflict": true/false}

Each conflict string should name both sources and what they disagree about. If there are no contradictions, return {"conflicts": [], "hasConflict": false}.

Return ONLY the JSON object, no other text.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  let conflicts: string[] = [];
  let hasConflict = false;

  try {
    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const parsed = JSON.parse(text);
    conflicts = parsed.conflicts || [];
    hasConflict = parsed.hasConflict || false;
  } catch {
    console.error("Failed to parse conflict detection response");
  }

  // Determine confidence
  let confidence: "high" | "medium" | "low";
  if (hasConflict) {
    confidence = "low";
  } else if (facts.length > 0) {
    // Structured fact match exists, no contradictions
    confidence = "high";
  } else {
    // Vector-only answer, no structured fact
    confidence = "medium";
  }

  return { conflictFlag: hasConflict, conflicts, confidence };
}
