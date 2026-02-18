import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const { body, subject } = await request.json();

    if (!body || typeof body !== "string") {
      return NextResponse.json(
        { error: "body is required" },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch provider token
    const serviceClient = createServiceClient();
    const { data: tokenRow, error: tokenError } = await serviceClient
      .from("provider_tokens")
      .select("access_token, expires_at")
      .eq("user_id", user.id)
      .single();

    if (tokenError || !tokenRow) {
      console.error("Provider token lookup failed:", tokenError?.message, "user_id:", user.id);
      return NextResponse.json(
        { error: "Gmail not connected. Please log out and log back in to grant Gmail access." },
        { status: 403 }
      );
    }

    // Check if token is expired
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      console.error("Provider token expired. expires_at:", tokenRow.expires_at, "now:", new Date().toISOString());
      return NextResponse.json(
        { error: "Gmail token expired. Please log out and log back in to refresh access." },
        { status: 403 }
      );
    }

    // Build RFC 2822 email message (no To — user fills that in Gmail)
    const emailLines = [
      "Content-Type: text/plain; charset=utf-8",
      "MIME-Version: 1.0",
      ...(subject ? [`Subject: ${subject}`] : []),
      "",
      body,
    ];
    const rawMessage = emailLines.join("\r\n");

    // Base64url encode the message
    const encoded = Buffer.from(rawMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Create draft via Gmail API
    const gmailRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenRow.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: { raw: encoded },
        }),
      }
    );

    if (!gmailRes.ok) {
      const gmailError = await gmailRes.text();
      console.error("Gmail API error:", gmailRes.status, gmailError);

      if (gmailRes.status === 401) {
        return NextResponse.json(
          { error: "Gmail token expired. Please log out and log back in to refresh access." },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create Gmail draft" },
        { status: 500 }
      );
    }

    const draft = await gmailRes.json();

    return NextResponse.json({
      success: true,
      draftId: draft.id,
    });
  } catch (err) {
    console.error("Gmail draft error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
