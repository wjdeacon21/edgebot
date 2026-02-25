import { createServiceClient } from "@/lib/supabase";
import { retrieveRelevantChunks, retrieveStructuredFacts } from "@/lib/retrieval";
import { detectConflicts } from "@/lib/conflicts";
import { streamGenerateResponse, parseGenerateResponse } from "@/lib/claude";

export async function POST(request: Request) {
  const { rawEmail, intentCategory, ticketStatus, senderName } = await request.json();

  if (!rawEmail || typeof rawEmail !== "string") {
    return new Response(JSON.stringify({ error: "rawEmail is required" }), { status: 400 });
  }

  // 1. Retrieve relevant chunks, structured facts, and tone examples
  const supabase = createServiceClient();
  const [chunks, facts, toneExamplesResult] = await Promise.all([
    retrieveRelevantChunks(rawEmail),
    retrieveStructuredFacts(),
    supabase
      .from("tone_examples")
      .select("body")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const toneExamples = toneExamplesResult.data?.map((r) => r.body) ?? [];

  // 2. Detect conflicts
  const conflictResult = await detectConflicts(chunks, facts);

  const sourcesUsed = chunks.map((c) => ({
    source_id: c.source_id,
    source_type: c.source_type,
    page_number: c.page_number,
    snippet: c.text.slice(0, 150),
  }));

  const encoder = new TextEncoder();

  // 3. Stream Claude response, save to DB, then send done event
  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";

      try {
        for await (const chunk of streamGenerateResponse({
          rawEmail,
          topChunks: chunks,
          structuredFacts: facts,
          conflictFlag: conflictResult.conflictFlag,
          conflicts: conflictResult.conflicts,
          intentCategory,
          ticketStatus,
          senderName,
          toneExamples,
        })) {
          fullText += chunk;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "text", content: chunk })}\n\n`)
          );
        }

        // Parse and save
        const { suggestedReply, subjectLine } = parseGenerateResponse(fullText);

        const { data: emailQuery, error: insertError } = await supabase
          .from("email_queries")
          .insert({
            raw_email: rawEmail,
            suggested_reply: suggestedReply,
            conflict_flag: conflictResult.conflictFlag,
            sources_used: sourcesUsed,
            status: "pending",
            ...(intentCategory ? { intent_category: intentCategory } : {}),
            ...(ticketStatus ? { ticket_status: ticketStatus } : {}),
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("Failed to save email query:", insertError.message);
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "done",
              id: emailQuery?.id || null,
              subjectLine,
              conflictFlag: conflictResult.conflictFlag,
            })}\n\n`
          )
        );
      } catch (error) {
        console.error("Generate stream error:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: error instanceof Error ? error.message : "Unknown error" })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
