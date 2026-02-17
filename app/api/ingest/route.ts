import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { extractTextFromPdf } from "@/lib/pdf";
import { chunkPages } from "@/lib/chunking";
import { generateEmbedding } from "@/lib/claude";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Extract text from PDF
    const buffer = Buffer.from(await file.arrayBuffer());
    const { pages } = await extractTextFromPdf(buffer);

    if (pages.length === 0) {
      return NextResponse.json(
        { error: "No text could be extracted from the PDF" },
        { status: 400 }
      );
    }

    // Chunk the pages
    const chunks = chunkPages(pages);

    // Insert document record
    const { data: doc, error: docError } = await supabase
      .from("pdf_documents")
      .insert({
        name: file.name,
      })
      .select("id")
      .single();

    if (docError || !doc) {
      return NextResponse.json(
        { error: `Failed to create document record: ${docError?.message}` },
        { status: 500 }
      );
    }

    // Generate embeddings and insert chunks
    let chunkCount = 0;
    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.text);

      const { error: chunkError } = await supabase
        .from("content_chunks")
        .insert({
          source_id: doc.id,
          source_type: "pdf",
          page_number: chunk.pageNumber,
          section_heading: chunk.sectionHeading,
          text: chunk.text,
          embedding,
        });

      if (chunkError) {
        console.error(`Failed to insert chunk: ${chunkError.message}`);
        continue;
      }

      chunkCount++;
    }

    return NextResponse.json({
      success: true,
      documentId: doc.id,
      chunkCount,
    });
  } catch (error) {
    console.error("Ingestion error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
      { status: 500 }
    );
  }
}
