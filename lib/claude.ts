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

const toneModifiers: Record<string, string> = {
  info: "The person needs information. Be warm, specific, and clear.",
  action: "The person wants to complete a specific action, like a ticket transfer or cancellation. Be efficient and direct. If something has gone wrong, lead with empathy.",
  offer: "An inbound offer from a vendor, partner, sponsor, or volunteer. Be professional and non-committal. Route to the appropriate contact if needed.",
  other: "This email doesn't fit a specific category. Be warm, helpful, and use good judgment.",
};

export async function classifyEmail(rawEmail: string): Promise<{
  intent: "info" | "action" | "offer" | "other";
  reasoning: string;
}> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 256,
    system: `You classify inbound emails into one of four intent categories.

Categories:
- info: The person is seeking information, whether to make a purchase decision or assist with logistics.
- action: The person wants to take a specific action, like a ticket transfer or cancellation.
- offer: An inbound vendor, partner, sponsor, volunteer, or similar external party.
- other: All other email intents that don't clearly fit the above.

Respond in EXACTLY this format:
Intent: [info|action|offer|other]
Reasoning: [One sentence explaining why]`,
    messages: [{ role: "user", content: `EMAIL:\n${rawEmail}` }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  const intentMatch = text.match(/Intent:\s*(info|action|offer|other)/i);
  const reasoningMatch = text.match(/Reasoning:\s*(.+)/i);

  const intent = (intentMatch?.[1]?.toLowerCase() || "info") as
    | "info"
    | "action"
    | "offer"
    | "other";
  const reasoning = reasoningMatch?.[1]?.trim() || "";

  return { intent, reasoning };
}

const ticketStatusModifiers: Record<string, string> = {
  purchased: "This person has purchased a ticket to Edge City. Welcome them warmly and be helpful and specific. Prioritize clarity and concision.",
  not_purchased: "This person has not yet purchased a ticket to Edge City. Be warm and informational. If it's natural to do so, gently highlight what makes Edge special — the community, the depth of programming, the experience of being there — but do not be salesy or pushy. Let the quality speak for itself.",
};

export async function classifyTicketStatus(rawEmail: string): Promise<{
  ticket_status: "purchased" | "not_purchased" | "unknown";
}> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 128,
    system: `You determine whether an inbound email explicitly indicates that the sender has or has not purchased a ticket to Edge City.

IMPORTANT: Default to "unknown". Only classify as "purchased" or "not_purchased" if the email contains very explicit, unambiguous evidence — such as the person directly stating they have bought a ticket, referencing a confirmation or order number, or clearly stating they have not bought one and are asking about doing so.

Do not infer. Do not guess. If there is any doubt, return "unknown".

Respond in EXACTLY this format:
Ticket status: [purchased|not_purchased|unknown]`,
    messages: [{ role: "user", content: `EMAIL:\n${rawEmail}` }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  const match = text.match(/Ticket status:\s*(purchased|not_purchased|unknown)/i);
  const ticket_status = (match?.[1]?.toLowerCase() || "unknown") as
    | "purchased"
    | "not_purchased"
    | "unknown";

  return { ticket_status };
}

export async function generateResponse(params: {
  rawEmail: string;
  topChunks: ContentChunk[];
  structuredFacts: StructuredFact[];
  conflictFlag: boolean;
  conflicts?: string[];
  intentCategory?: string;
  ticketStatus?: string;
  senderName?: string;
  toneExamples?: string[];
}): Promise<{
  suggestedReply: string;
  subjectLine: string;
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

  const toneModifier = params.intentCategory
    ? toneModifiers[params.intentCategory]
    : null;
  const ticketModifier = params.ticketStatus
    ? ticketStatusModifiers[params.ticketStatus]
    : null;
  const modifierPrefix = [toneModifier, ticketModifier].filter(Boolean).join(" ") ;

  const toneExamplesBlock =
    params.toneExamples && params.toneExamples.length > 0
      ? `\n\nTONE EXAMPLES — past replies written in the voice and style we want. Match their naturalness:\n\n${params.toneExamples
          .slice(0, 5)
          .map((e) => `<example>\n${e}\n</example>`)
          .join("\n\n")}`
      : "";

  const systemPrompt = `${modifierPrefix ? `${modifierPrefix}\n\n` : ""}You are an internal operations employee for Edge City. Your job is to answer participant emails accurately.

RULES:
- You are a human being. Never say anything to suggest otherwise.
- Accuracy over speed. Never fabricate information.
- The SUGGESTED REPLY is sent directly to participants — it must NEVER contain citations, source references, page numbers, document names, or any indication that you consulted internal documents.
- If you are unsure, say so explicitly. Do not guess.
- Structured facts override raw text chunks when they exist.
- Be warm and friendly, and also direct and professional. No emojis. No speculation.
- The SUGGESTED REPLY must be plain prose only — no bold (**), no bullet points (-), no numbered lists, no headers. Write in natural prose paragraphs as you would in a real email.
- When a relevant URL is available from structured facts, write it as a Markdown link: [display text](url). Do not include raw URLs.
- Begin the SUGGESTED REPLY with a salutation. Infer the addressee's first name from the email if possible (e.g. "Hi Sarah,"). If the name is unclear, use "Hi there,".
- End the SUGGESTED REPLY with a sign-off: "Best," on its own line, then a blank line, then "${params.senderName || "[Your name]"}" on the next line.${toneExamplesBlock}

Respond in EXACTLY this format:

--- SUBJECT LINE ---
[A concise, professional email subject line for the reply. E.g. "Re: Accommodation Details for Edge City"]

--- SUGGESTED REPLY ---
[A direct, warm reply to the participant. First paragraph answers their question. No emojis, no speculation. NEVER include citations, source references, or document names — this text is sent directly to the participant. 
Check the text for redundancy before sending. Be professional, but skew towards the formality level of the incoming email--casual in, casual out. Aim for naturalistic responses. Keep replies short, ideally one or two paragraphs unless more detail is needed.]

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
  const subjectLineMatch = text.match(
    /---\s*SUBJECT LINE\s*---\s*([\s\S]*?)(?=---\s*SUGGESTED REPLY\s*---|$)/i
  );
  const suggestedReplyMatch = text.match(
    /---\s*SUGGESTED REPLY\s*---\s*([\s\S]*?)(?=---\s*IF UNSURE\s*---|$)/i
  );

  const subjectLine = subjectLineMatch?.[1]?.trim() || "Re: Your Edge City Inquiry";
  const suggestedReply = suggestedReplyMatch?.[1]?.trim() || "";

  return {
    suggestedReply,
    subjectLine,
  };
}
