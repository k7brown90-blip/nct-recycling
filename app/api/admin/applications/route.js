import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.ADMIN_SECRET}`;
  return auth === expected;
}

// GET — list all applications (optionally filter by status)
export async function GET(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // 'pending', 'approved', 'denied', or null for all

  const supabase = createServiceClient();
  let query = supabase
    .from("reseller_applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch applications." }, { status: 500 });
  }

  return NextResponse.json({ applications: data });
}

// DELETE — permanently remove an application
export async function DELETE(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase.from("reseller_applications").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Delete failed." }, { status: 500 });

  return NextResponse.json({ success: true });
}

// PATCH — approve/deny an application OR update profile fields
export async function PATCH(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const supabase = createServiceClient();

  // Status update (approve/deny/pending)
  if (body.status !== undefined) {
    if (!["approved", "denied", "pending"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    const { error } = await supabase
      .from("reseller_applications")
      .update({
        status: body.status,
        admin_notes: body.admin_notes || null,
        reviewed_by: body.reviewed_by || "admin",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Profile field update
  const PROFILE_FIELDS = [
    "full_name", "business_name", "email", "phone",
    "wants_warehouse_access", "admin_notes",
  ];
  const updates = {};
  for (const key of PROFILE_FIELDS) {
    if (key in body) updates[key] = body[key] || null;
  }

  const { error } = await supabase.from("reseller_applications").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });
  return NextResponse.json({ success: true });
}
