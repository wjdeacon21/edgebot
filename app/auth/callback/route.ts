import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isEmailAllowed } from "@/lib/allowlist";
import { createServiceClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  // Create the redirect response upfront so cookies are set directly on it.
  const supabaseResponse = NextResponse.redirect(`${origin}/review-drafts`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !session) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Check allowlist before committing the session
  if (!session.user.email || !isEmailAllowed(session.user.email)) {
    return NextResponse.redirect(`${origin}/login?error=not_allowed`);
  }

  // Store provider token for Gmail API access
  if (session.provider_token) {
    const serviceClient = createServiceClient();
    await serviceClient.from("provider_tokens").upsert({
      user_id: session.user.id,
      access_token: session.provider_token,
      refresh_token: session.provider_refresh_token || null,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  }

  // Return the response with session cookies already attached
  return supabaseResponse;
}
