import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { retrieveRelevantChunks, retrieveStructuredFacts } from "@/lib/retrieval";
import { detectConflicts } from "@/lib/conflicts";
import { generateResponse } from "@/lib/claude";

export async function POST(request: Request) {
  try {
    const { rawEmail, intentCategory, ticketStatus, senderName } = await request.json();

    if (!rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json(
        { error: "rawEmail is required" },
        { status: 400 }
      );
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

    // 3. Generate response
    const response = await generateResponse({
      rawEmail,
      topChunks: chunks,
      structuredFacts: facts,
      conflictFlag: conflictResult.conflictFlag,
      conflicts: conflictResult.conflicts,
      intentCategory,
      ticketStatus,
      senderName,
      toneExamples,
    });

    // 4. Save to email_queries
    const sourcesUsed = chunks.map((c) => ({
      source_id: c.source_id,
      source_type: c.source_type,
      page_number: c.page_number,
      snippet: c.text.slice(0, 150),
    }));

    const { data: emailQuery, error: insertError } = await supabase
      .from("email_queries")
      .insert({
        raw_email: rawEmail,
        suggested_reply: response.suggestedReply,
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

    return NextResponse.json({
      id: emailQuery?.id || null,
      suggestedReply: response.suggestedReply,
      subjectLine: response.subjectLine,
      conflictFlag: conflictResult.conflictFlag,
      conflicts: conflictResult.conflicts,
      sourcesUsed,
    });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}
