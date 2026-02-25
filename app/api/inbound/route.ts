import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { retrieveRelevantChunks, retrieveStructuredFacts } from "@/lib/retrieval";
import { detectConflicts } from "@/lib/conflicts";
import { generateResponse, classifyEmail, classifyTicketStatus } from "@/lib/claude";

// Strip quoted reply chains — truncate at first "On ... wrote:" line
function stripQuotedReplies(text: string): string {
  const match = text.match(/\nOn .+wrote:/);
  if (match && match.index !== undefined) {
    return text.slice(0, match.index).trim();
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

    const emailBody = stripQuotedReplies(rawBody);

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
      retrieveStructuredFacts(emailBody),
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
