import { NextResponse } from "next/server";
import { retrieveRelevantChunks, retrieveStructuredFacts } from "@/lib/retrieval";

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const [chunks, facts] = await Promise.all([
      retrieveRelevantChunks(query),
      retrieveStructuredFacts(query),
    ]);

    return NextResponse.json({
      query,
      chunks: chunks.map((c) => ({
        id: c.id,
        source_type: c.source_type,
        page_number: c.page_number,
        section_heading: c.section_heading,
        text: c.text.slice(0, 200) + (c.text.length > 200 ? "..." : ""),
      })),
      facts,
      chunkCount: chunks.length,
      factCount: facts.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
