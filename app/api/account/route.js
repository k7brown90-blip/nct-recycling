import { createClient } from "@/lib/supabase-server";
import { syncCanonicalCoOpAdminState } from "@/lib/canonical-organizations";
import { syncDiscardAccountToCanonical } from "@/lib/discard-canonical";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { NextResponse } from "next/server";

// PATCH — update profile fields in the linked application table
export async function PATCH(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);

  if (!profile?.application_id && !profile?.discard_account_id) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const body = await request.json();

  const NONPROFIT_FIELDS = [
    "contact_name", "contact_title", "phone", "website",
    "address_street", "address_city", "address_state", "address_zip",
    "available_pickup_hours", "dock_instructions",
  ];
  const DISCARD_FIELDS = [
    "org_name", "contact_name", "contact_email", "contact_phone",
    "address_street", "address_city", "address_state", "address_zip",
  ];
  const RESELLER_FIELDS = [
    "full_name", "business_name", "phone", "website",
  ];

  const allowed = profile.role === "nonprofit"
    ? NONPROFIT_FIELDS
    : profile.role === "discard"
      ? DISCARD_FIELDS
      : RESELLER_FIELDS;
  const table = profile.role === "nonprofit"
    ? "nonprofit_applications"
    : profile.role === "discard"
      ? "discard_accounts"
      : "reseller_applications";
  const recordId = profile.role === "discard" ? profile.discard_account_id : profile.application_id;

  const updates = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await db.from(table).update(updates).eq("id", recordId);
  if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });

  try {
    if (profile.role === "nonprofit") {
      const { data: application } = await db
        .from("nonprofit_applications")
        .select("*")
        .eq("id", profile.application_id)
        .maybeSingle();

      if (application) {
        await syncCanonicalCoOpAdminState(db, application);
      }
    } else if (profile.role === "discard") {
      const { data: account } = await db
        .from("discard_accounts")
        .select("*")
        .eq("id", profile.discard_account_id)
        .maybeSingle();

      if (account) {
        await syncDiscardAccountToCanonical(db, account);
      }
    }
  } catch (canonicalError) {
    console.error("Canonical account settings sync error:", canonicalError);
  }

  return NextResponse.json({ success: true });
}
