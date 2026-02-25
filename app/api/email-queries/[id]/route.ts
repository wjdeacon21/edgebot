import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServiceClient();

    const { error } = await supabase
      .from("email_queries")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, approved_version, approved_by, intent_category, was_manually_overridden, ticket_status } = body;

    const supabase = createServiceClient();

    const update: Record<string, unknown> = {};
    if (status) update.status = status;
    if (approved_version !== undefined) update.approved_version = approved_version;
    if (approved_by !== undefined) update.approved_by = approved_by;
    if (intent_category !== undefined) update.intent_category = intent_category;
    if (was_manually_overridden !== undefined) update.was_manually_overridden = was_manually_overridden;
    if (ticket_status !== undefined) update.ticket_status = ticket_status;

    const { data, error } = await supabase
      .from("email_queries")
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
