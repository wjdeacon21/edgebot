import { createServiceClient } from "@/lib/supabase";
import { generateEmbedding } from "@/lib/claude";
import { ContentChunk, StructuredFact } from "@/types";

export async function retrieveRelevantChunks(
  queryText: string,
  topK: number = 5
): Promise<ContentChunk[]> {
  const embedding = await generateEmbedding(queryText);
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: embedding,
    match_count: topK,
    match_threshold: 0.0,
  });

  if (error) {
    console.error("match_chunks RPC error:", error.message);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    source_id: row.source_id as string,
    source_type: row.source_type as "pdf" | "web",
    page_number: row.page_number as number | null,
    section_heading: row.section_heading as string | null,
    text: row.text as string,
    embedding: null,
    created_at: "",
  }));
}

export async function retrieveStructuredFacts(): Promise<StructuredFact[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("structured_facts")
    .select("*")
    .eq("status", "active");

  if (error) {
    console.error("Structured facts query error:", error.message);
    return [];
  }

  return data || [];
}
