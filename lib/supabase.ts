import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Server-side admin client using service role key — bypasses RLS
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Re-export the cookie-based clients for convenience
export { createClient as createServerClient } from "./supabase-server";
export { createClient as createBrowserClient } from "./supabase-browser";
