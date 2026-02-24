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
    const { intent_category } = await request.json();

    if (!intent_category || typeof intent_category !== "string") {
      return NextResponse.json(
        { error: "intent_category is required" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Fetch the existing record
    const { data: record, error: fetchError } = await supabase
      .from("email_queries")
      .select("raw_email")
      .eq("id", id)
      .single();

    if (fetchError || !record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const rawEmail: string = record.raw_email;

    // Run the full pipeline with the new intent
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
      intentCategory: intent_category,
    });

    // Update the record
    const { error: updateError } = await supabase
      .from("email_queries")
      .update({
        suggested_reply: response.suggestedReply,
        intent_category,
        was_manually_overridden: true,
      })
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
