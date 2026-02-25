import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { retrieveRelevantChunks, retrieveStructuredFacts } from "@/lib/retrieval";
import { detectConflicts } from "@/lib/conflicts";
import { generateResponse, classifyEmail, classifyTicketStatus } from "@/lib/claude";

// Extract the actual participant message from an email body.
// Handles two cases:
//   1. Reply chain — keep only the new message (content before "On [date] ... wrote:")
//   2. Forward — the "On ... wrote:" line IS the forwarding header, so extract content after it
// Also handles Gmail's "---------- Forwarded message ---------" format.
function extractEmailBody(text: string): string {
  // Case 1 & 2: "On [date] [name] wrote:" pattern
  const replyMatch = text.match(/\nOn .+wrote:/);
  if (replyMatch && replyMatch.index !== undefined) {
    const before = text.slice(0, replyMatch.index).trim();
    if (before.length > 0) {
      // Reply with quoted history — keep only the new message
      return before;
    }
    // Nothing before the marker — this is a forward.
    // Extract what's after the "On ... wrote:" line, stripping ">" quote prefixes.
    const after = text.slice(replyMatch.index + replyMatch[0].length).trim();
    return after.replace(/^>\s?/gm, "").trim();
  }

  // Case 3: Gmail "---------- Forwarded message ---------" format
  // Headers (From/Date/Subject/To) appear on the lines immediately after the dashes,
  // then a blank line separates them from the actual body.
  const fwdMatch = text.match(/^-{4,}\s*Forwarded message\s*-{4,}[\s\S]*?\n\n([\s\S]+)/im);
  if (fwdMatch) {
    return fwdMatch[1].trim();
  }

  return text.trim();
}

export async function POST(request: NextRequest) {
  // Security: validate shared secret embedded in the webhook URL
  const secret = request.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.POSTMARK_INBOUND_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await request.json();

    // Postmark inbound payload uses PascalCase field names
    const from: string = payload.From || "";
    const subject: string = payload.Subject || "";
    const rawBody: string = payload.TextBody || payload.HtmlBody || "";

    if (!rawBody.trim()) {
      return NextResponse.json({ error: "Empty email body" }, { status: 400 });
    }

    const emailBody = extractEmailBody(rawBody);

    if (!emailBody) {
      return NextResponse.json({ error: "Could not extract email body" }, { status: 400 });
    }

    // Magic subject prefix: store as tone example and short-circuit
    const TONE_EXAMPLE_PREFIX = "tone:";
    if (subject.toLowerCase().startsWith(TONE_EXAMPLE_PREFIX)) {
      const supabase = createServiceClient();
      await supabase.from("tone_examples").insert({ body: emailBody });
      return NextResponse.json({ ok: true });
    }

    // Fetch tone examples alongside RAG + classifications
    const supabase = createServiceClient();
    const [chunks, facts, classification, ticketClassification, toneExamplesResult] = await Promise.all([
      retrieveRelevantChunks(emailBody),
      retrieveStructuredFacts(),
      classifyEmail(emailBody).catch((err) => {
        console.error("classifyEmail failed:", err);
        return null;
      }),
      classifyTicketStatus(emailBody).catch((err) => {
        console.error("classifyTicketStatus failed:", err);
        return null;
      }),
      supabase
        .from("tone_examples")
        .select("body")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const toneExamples = toneExamplesResult.data?.map((r) => r.body) ?? [];

    const conflictResult = await detectConflicts(chunks, facts);

    const response = await generateResponse({
      rawEmail: emailBody,
      topChunks: chunks,
      structuredFacts: facts,
      conflictFlag: conflictResult.conflictFlag,
      conflicts: conflictResult.conflicts,
      intentCategory: classification?.intent,
      ticketStatus: ticketClassification?.ticket_status,
      toneExamples,
    });

    const sourcesUsed = chunks.map((c) => ({
      source_id: c.source_id,
      source_type: c.source_type,
      page_number: c.page_number,
      snippet: c.text.slice(0, 150),
    }));

    const { error: insertError } = await supabase.from("email_queries").insert({
      raw_email: emailBody,
      suggested_reply: response.suggestedReply,
      conflict_flag: conflictResult.conflictFlag,
      sources_used: sourcesUsed,
      status: "pending",
      source: "forwarded",
      subject,
      from_address: from,
      intent_category: classification?.intent ?? null,
      ticket_status: ticketClassification?.ticket_status ?? null,
    });

    if (insertError) {
      console.error("Failed to save inbound email:", insertError.message);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }

    // Postmark expects a 2xx to confirm delivery
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Inbound webhook error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
