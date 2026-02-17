import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    // Delete associated content_chunks first (foreign key dependency)
    const { error: chunksError } = await supabase
      .from("content_chunks")
      .delete()
      .eq("source_id", id);

    if (chunksError) {
      return NextResponse.json({ error: chunksError.message }, { status: 500 });
    }

    // Delete the document itself
    const { error: docError } = await supabase
      .from("pdf_documents")
      .delete()
      .eq("id", id);

    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
