import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { retrieveRelevantChunks, retrieveStructuredFacts } from "@/lib/retrieval";
import { detectConflicts } from "@/lib/conflicts";
import { generateResponse } from "@/lib/claude";

export async function POST(request: Request) {
  try {
    const { rawEmail } = await request.json();

    if (!rawEmail || typeof rawEmail !== "string") {
      return NextResponse.json(
        { error: "rawEmail is required" },
        { status: 400 }
      );
    }

    // 1. Retrieve relevant chunks and structured facts
    const [chunks, facts] = await Promise.all([
      retrieveRelevantChunks(rawEmail),
      retrieveStructuredFacts(rawEmail),
    ]);

    // 2. Detect conflicts
    const conflictResult = await detectConflicts(chunks, facts);

    // 3. Generate response
    const response = await generateResponse({
      rawEmail,
      topChunks: chunks,
      structuredFacts: facts,
      conflictFlag: conflictResult.conflictFlag,
      conflicts: conflictResult.conflicts,
    });

    // 4. Save to email_queries
    const supabase = createServiceClient();

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
        confidence_score: response.confidence,
        conflict_flag: conflictResult.conflictFlag,
        sources_used: sourcesUsed,
        status: "pending",
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
      confidence: response.confidence,
      conflictFlag: conflictResult.conflictFlag,
      conflicts: response.conflicts,
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
