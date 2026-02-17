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

export async function retrieveStructuredFacts(
  queryText: string
): Promise<StructuredFact[]> {
  const supabase = createServiceClient();

  // Extract keywords: split on whitespace, filter short/common words
  const stopWords = new Set([
    "i", "me", "my", "we", "our", "you", "your", "he", "she", "it", "they",
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "can", "may", "might", "shall", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "about", "between",
    "through", "during", "before", "after", "and", "but", "or", "not",
    "no", "if", "then", "than", "so", "what", "when", "where", "how",
    "which", "who", "whom", "this", "that", "these", "those", "there",
    "here", "all", "each", "any", "some", "much", "many", "very",
  ]);

  const keywords = queryText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (keywords.length === 0) return [];

  // Query structured facts where category or key matches any keyword
  const orFilters = keywords
    .map((kw) => `category.ilike.%${kw}%,key.ilike.%${kw}%`)
    .join(",");

  const { data, error } = await supabase
    .from("structured_facts")
    .select("*")
    .eq("status", "active")
    .or(orFilters);

  if (error) {
    console.error("Structured facts query error:", error.message);
    return [];
  }

  return data || [];
}
