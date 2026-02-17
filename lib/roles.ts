import { createServiceClient } from "@/lib/supabase";

export async function getUserRole(
  userId: string
): Promise<"ops_reviewer" | "admin"> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    return "ops_reviewer";
  }

  return data.role === "admin" ? "admin" : "ops_reviewer";
}
