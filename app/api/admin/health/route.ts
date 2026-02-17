import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServiceClient();

  const [chunksRes, embeddingsRes, docsRes, factsRes] = await Promise.all([
    supabase
      .from("content_chunks")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("content_chunks")
      .select("id", { count: "exact", head: true })
      .not("embedding", "is", null),
    supabase
      .from("pdf_documents")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("structured_facts")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  return NextResponse.json({
    totalChunks: chunksRes.count || 0,
    totalEmbeddings: embeddingsRes.count || 0,
    activeDocs: docsRes.count || 0,
    activeFacts: factsRes.count || 0,
  });
}
