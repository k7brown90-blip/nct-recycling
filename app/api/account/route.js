import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

// PATCH — update profile fields in the linked application table
export async function PATCH(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("role, application_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.application_id) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const body = await request.json();

  const NONPROFIT_FIELDS = [
    "contact_name", "contact_title", "phone", "website",
    "address_street", "address_city", "address_state", "address_zip",
    "available_pickup_hours", "dock_instructions",
  ];
  const RESELLER_FIELDS = [
    "full_name", "business_name", "phone", "website",
  ];

  const allowed = profile.role === "nonprofit" ? NONPROFIT_FIELDS : RESELLER_FIELDS;
  const table   = profile.role === "nonprofit" ? "nonprofit_applications" : "reseller_applications";

  const updates = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await db.from(table).update(updates).eq("id", profile.application_id);
  if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });

  return NextResponse.json({ success: true });
}
