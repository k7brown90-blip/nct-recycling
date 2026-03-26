import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

// GET — list pickup requests with nonprofit info, optional status filter
export async function GET(request) {
  if (!checkAdminAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const db = createServiceClient();
  let query = db
    .from("nonprofit_pickup_requests")
    .select(`
      id, estimated_bags, estimated_weight_lbs, preferred_date, notes, status, created_at,
      nonprofit_id,
      nonprofit_applications (id, org_name, contact_name, email, address_street, address_city, address_state)
    `)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  return NextResponse.json({ requests: data });
}

// PATCH — update request status
export async function PATCH(request) {
  if (!checkAdminAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id, status } = await request.json();
  if (!id || !status) return NextResponse.json({ error: "Missing id or status." }, { status: 400 });

  const valid = ["pending", "scheduled", "cancelled"];
  if (!valid.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });

  const db = createServiceClient();
  const { error } = await db
    .from("nonprofit_pickup_requests")
    .update({ status })
    .eq("id", id);

  if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });
  return NextResponse.json({ success: true });
}
