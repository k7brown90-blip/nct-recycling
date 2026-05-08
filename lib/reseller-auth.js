import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";

export function canAccessResellerStore(reseller) {
  return Boolean(reseller && reseller.status === "approved");
}

// Columns that exist on every deployed schema (pre-v21).
const RESELLER_BASE_COLUMNS =
  "id, full_name, email, business_name, phone, contract_signed_name, contract_agreed_at, created_at, status";

// Columns added by schema v21. Selected only when the migration is applied
// to the live database. We probe first to avoid the entire query failing
// (and the dashboard redirecting in a loop) if v21 has not been run yet.
const RESELLER_V21_COLUMNS = "wants_warehouse_access, tier, agreement_template_id, agreement_version";

let cachedHasV21Columns = null;

async function detectV21Columns(db) {
  if (cachedHasV21Columns !== null) return cachedHasV21Columns;
  const { error } = await db
    .from("reseller_applications")
    .select(`id, ${RESELLER_V21_COLUMNS}`)
    .limit(1);
  cachedHasV21Columns = !error;
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[reseller-auth] v21 columns missing on reseller_applications, running in compat mode:", error.message);
  }
  return cachedHasV21Columns;
}

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

  const hasV21 = await detectV21Columns(db);
  const columns = hasV21
    ? `${RESELLER_BASE_COLUMNS}, ${RESELLER_V21_COLUMNS}`
    : RESELLER_BASE_COLUMNS;

  const { data: reseller, error } = await db
    .from("reseller_applications")
    .select(columns)
    .eq("id", profile.application_id)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[reseller-auth] reseller lookup failed:", error.message);
    return { user, db, profile, reseller: null };
  }

  // Provide stable defaults so callers (UI, catalog API) never see undefined
  // for fields they expect, regardless of whether v21 has been applied.
  const normalized = reseller
    ? {
        ...reseller,
        wants_warehouse_access: Boolean(reseller.wants_warehouse_access),
        tier: reseller.tier || "public",
        agreement_template_id: reseller.agreement_template_id ?? null,
        agreement_version: reseller.agreement_version ?? null,
      }
    : null;

  return { user, db, profile, reseller: normalized };
}
