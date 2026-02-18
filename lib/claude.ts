import Anthropic from "@anthropic-ai/sdk";
import { ContentChunk, StructuredFact } from "@/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
  conflicts?: string[];
}): Promise<{
  suggestedReply: string;
  subjectLine: string;
  confidence: string;
  conflicts: string[];
}> {
  const chunksContext = params.topChunks
    .map(
      (c, i) =>
        `[Source ${i + 1} | type: ${c.source_type} | page: ${c.page_number}${c.section_heading ? ` | section: ${c.section_heading}` : ""}]\n${c.text}`
    )
    .join("\n\n");

  const factsContext = params.structuredFacts
    .map(
      (f) =>
        `[${f.category}] ${f.key}: ${f.value} (source: ${f.source_document || "unknown"}, page: ${f.page_number ?? "N/A"}, confidence: ${f.confidence})`
    )
    .join("\n");

  const conflictContext =
    params.conflictFlag && params.conflicts?.length
      ? `\n\nCONFLICT ALERT: The following conflicts were detected:\n${params.conflicts.map((c) => `- ${c}`).join("\n")}`
      : "";

  const systemPrompt = `You are an internal operations employee for Edge City. Your job is to answer participant emails accurately.

RULES:
- You are a human being. Never say anything to suggest otherwise.
- Accuracy over speed. Never fabricate information.
- In the ANALYSIS section only: cite sources with document name and page number, and flag inconsistencies.
- The SUGGESTED REPLY is sent directly to participants — it must NEVER contain citations, source references, page numbers, document names, or any indication that you consulted internal documents.
- If you are unsure, say so explicitly. Do not guess.
- Structured facts override raw text chunks when they exist.
- Be warm and friendly, and also direct and professional. No emojis. No speculation.
- The SUGGESTED REPLY must be plain text only — no markdown, no bold (**), no bullet points (-), no numbered lists, no headers. Write in natural prose paragraphs as you would in a real email.

Respond in EXACTLY this format:

--- ANALYSIS ---
Confidence: [High/Medium/Low]
Conflicts: [List each conflict, or "None"]

--- SUBJECT LINE ---
[A concise, professional email subject line for the reply. E.g. "Re: Accommodation Details for Edge City"]

--- SUGGESTED REPLY ---
[A direct, warm reply to the participant. First paragraph answers their question. No emojis, no speculation. NEVER include citations, source references, or document names — this text is sent directly to the participant.]

--- IF UNSURE ---
[Clarifying questions the staff member should consider, or "N/A"]`;

  const userMessage = `PARTICIPANT EMAIL:
${params.rawEmail}

RETRIEVED TEXT CHUNKS:
${chunksContext || "No relevant chunks found."}

STRUCTURED FACTS:
${factsContext || "No matching structured facts."}${conflictContext}

Please analyze this email and provide your response in the required format.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Parse the structured response
  const analysisMatch = text.match(
    /---\s*ANALYSIS\s*---\s*([\s\S]*?)(?=---\s*SUGGESTED REPLY\s*---|$)/i
  );
  const subjectLineMatch = text.match(
    /---\s*SUBJECT LINE\s*---\s*([\s\S]*?)(?=---\s*SUGGESTED REPLY\s*---|$)/i
  );
  const suggestedReplyMatch = text.match(
    /---\s*SUGGESTED REPLY\s*---\s*([\s\S]*?)(?=---\s*IF UNSURE\s*---|$)/i
  );

  const analysis = analysisMatch?.[1]?.trim() || text;
  const subjectLine = subjectLineMatch?.[1]?.trim() || "Re: Your Edge City Inquiry";
  const suggestedReply = suggestedReplyMatch?.[1]?.trim() || "";

  // Extract confidence
  const confidenceMatch = analysis.match(
    /Confidence:\s*(High|Medium|Low)/i
  );
  const confidence = confidenceMatch?.[1]?.toLowerCase() || "medium";

  // Extract conflicts
  const conflictsMatch = analysis.match(
    /Conflicts:\s*([\s\S]*?)(?=\n\n|$)/i
  );
  const conflictsText = conflictsMatch?.[1]?.trim() || "";
  const conflicts =
    conflictsText.toLowerCase() === "none" || !conflictsText
      ? params.conflicts || []
      : conflictsText
          .split("\n")
          .map((c) => c.replace(/^[-•]\s*/, "").trim())
          .filter(Boolean);

  return {
    suggestedReply,
    subjectLine,
    confidence,
    conflicts,
  };
}
