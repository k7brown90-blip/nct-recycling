import { createServiceClient } from "@/lib/supabase";

export async function getEmployeeProfileByUserId(userId, db = createServiceClient()) {
  if (!userId) return null;

  const { data, error } = await db
    .from("employee_profiles")
    .select("*")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Employee profile lookup failed: ${error.message}`);
  }

  return data;
}