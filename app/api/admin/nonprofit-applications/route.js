import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.ADMIN_SECRET}`;
  return auth === expected;
}

export async function GET(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const supabase = createServiceClient();
  let query = supabase
    .from("nonprofit_applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch applications." }, { status: 500 });
  }

  return NextResponse.json({ applications: data });
}

export async function DELETE(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const supabase = createServiceClient();
  const { error } = await supabase.from("nonprofit_applications").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Delete failed." }, { status: 500 });

  return NextResponse.json({ success: true });
}

export async function PATCH(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const updates = {};

  // Status update
  if (body.status !== undefined) {
    if (!["approved", "denied", "pending"].includes(body.status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    updates.status = body.status;
    updates.reviewed_by = "admin";
    updates.reviewed_at = new Date().toISOString();
  }

  // Admin notes (can be sent alone or with status)
  if (body.admin_notes !== undefined) {
    updates.admin_notes = body.admin_notes || null;
  }

  // Account type update (ltl or fl)
  if (body.account_type !== undefined) {
    if (!["ltl", "fl"].includes(body.account_type)) {
      return NextResponse.json({ error: "Invalid account_type." }, { status: 400 });
    }
    updates.account_type = body.account_type;
  }

  // Profile field edits (admin can update partner info)
  const PROFILE_FIELDS = [
    "org_name", "org_type", "contact_name", "contact_title", "phone", "website",
    "address_street", "address_city", "address_state", "address_zip",
    "pickup_address", "available_pickup_hours", "dock_instructions",
    "estimated_bags", "storage_capacity_bags",
  ];
  const INT_FIELDS = ["estimated_bags", "storage_capacity_bags"];
  for (const field of PROFILE_FIELDS) {
    if (body[field] !== undefined) {
      updates[field] = INT_FIELDS.includes(field)
        ? (body[field] === "" || body[field] === null ? null : parseInt(body[field]))
        : (body[field] || null);
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("nonprofit_applications")
    .update(updates)
    .eq("id", id);

  if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });

  return NextResponse.json({ success: true });
}
