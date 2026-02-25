import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { retrieveRelevantChunks, retrieveStructuredFacts } from "@/lib/retrieval";
import { detectConflicts } from "@/lib/conflicts";
import { generateResponse } from "@/lib/claude";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { intent_category, ticket_status, sender_name } = await request.json();

    const supabase = createServiceClient();

    // Fetch the existing record and tone examples in parallel
    const [{ data: record, error: fetchError }, toneExamplesResult] = await Promise.all([
      supabase
        .from("email_queries")
        .select("raw_email, intent_category, ticket_status")
        .eq("id", id)
        .single(),
      supabase
        .from("tone_examples")
        .select("body")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    if (fetchError || !record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const rawEmail: string = record.raw_email;
    const resolvedIntent = intent_category ?? record.intent_category ?? undefined;
    const resolvedTicketStatus = ticket_status ?? record.ticket_status ?? undefined;
    const toneExamples = toneExamplesResult.data?.map((r) => r.body) ?? [];

    const [chunks, facts] = await Promise.all([
      retrieveRelevantChunks(rawEmail),
      retrieveStructuredFacts(rawEmail),
    ]);

    const conflictResult = await detectConflicts(chunks, facts);

    const response = await generateResponse({
      rawEmail,
      topChunks: chunks,
      structuredFacts: facts,
      conflictFlag: conflictResult.conflictFlag,
      conflicts: conflictResult.conflicts,
      intentCategory: resolvedIntent,
      ticketStatus: resolvedTicketStatus,
      senderName: sender_name,
      toneExamples,
    });

    const updatePayload: Record<string, unknown> = {
      suggested_reply: response.suggestedReply,
      was_manually_overridden: true,
    };
    if (intent_category !== undefined) updatePayload.intent_category = intent_category;
    if (ticket_status !== undefined) updatePayload.ticket_status = ticket_status;

    const { error: updateError } = await supabase
      .from("email_queries")
      .update(updatePayload)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ suggestedReply: response.suggestedReply });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
