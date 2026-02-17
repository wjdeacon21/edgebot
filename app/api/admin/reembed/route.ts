import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/claude";

export async function POST() {
  const supabase = createServiceClient();

  // Get all chunks from active documents
  const { data: chunks, error } = await supabase
    .from("content_chunks")
    .select("id, text, source_id")
    .in(
      "source_id",
      (
        await supabase
          .from("pdf_documents")
          .select("id")
          .eq("status", "active")
      ).data?.map((d) => d.id) || []
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!chunks || chunks.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  let updated = 0;
  let failed = 0;

  for (const chunk of chunks) {
    try {
      const embedding = await generateEmbedding(chunk.text);
      const { error: updateError } = await supabase
        .from("content_chunks")
        .update({ embedding })
        .eq("id", chunk.id);

      if (updateError) {
        failed++;
      } else {
        updated++;
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ updated, failed, total: chunks.length });
}
