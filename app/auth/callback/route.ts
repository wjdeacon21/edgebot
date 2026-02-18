import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isEmailAllowed } from "@/lib/allowlist";
import { createServiceClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Store provider token for Gmail API access
  if (session?.provider_token) {
    const serviceClient = createServiceClient();
    await serviceClient.from("provider_tokens").upsert({
      user_id: session.user.id,
      access_token: session.provider_token,
      refresh_token: session.provider_refresh_token || null,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  }

  // Check allowlist
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !isEmailAllowed(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_allowed`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
