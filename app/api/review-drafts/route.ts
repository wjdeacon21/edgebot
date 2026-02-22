import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";

export async function GET() {
  // Authenticate the user via cookie-based client
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch forwarded email drafts using the service client
  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from("email_queries")
    .select("*")
    .eq("source", "forwarded")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch review drafts:", error.message);
    return NextResponse.json({ error: "Failed to fetch drafts" }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
