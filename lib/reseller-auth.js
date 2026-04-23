import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";

export async function getCurrentResellerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, db: null, profile: null, reseller: null };
  }

  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);

  if (!profile || !["reseller", "both"].includes(profile.role) || !profile.application_id) {
    return { user, db, profile, reseller: null };
  }

  const { data: reseller } = await db
    .from("reseller_applications")
    .select("id, full_name, email, business_name, phone, program_type, tax_license_number, contract_signed_name, contract_agreed_at, created_at, status")
    .eq("id", profile.application_id)
    .maybeSingle();

  return { user, db, profile, reseller: reseller || null };
}
