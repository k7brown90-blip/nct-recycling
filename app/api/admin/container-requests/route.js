import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

// GET — list container pickup requests, optionally filtered by ?application_id=
export async function GET(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const application_id = searchParams.get("application_id");

  const db = createServiceClient();
  let query = db
    .from("container_pickup_requests")
    .select("*, nonprofit_applications(org_name, email, address_street, address_city, address_state)")
    .order("created_at", { ascending: false });

  if (application_id) query = query.eq("application_id", application_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  return NextResponse.json({ requests: data || [] });
}

// PATCH — update status, admin_notes, or scheduled_date
export async function PATCH(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const updates = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) {
    const valid = ["pending", "reviewed", "scheduled", "completed", "cancelled"];
    if (!valid.includes(body.status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    updates.status = body.status;
  }
  if (body.admin_notes !== undefined) updates.admin_notes = body.admin_notes || null;
  if (body.scheduled_date !== undefined) updates.scheduled_date = body.scheduled_date || null;

  const db = createServiceClient();
  const { error } = await db.from("container_pickup_requests").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });

  return NextResponse.json({ success: true });
}

// POST — get a signed URL for the container photo
// Body: { request_id }
export async function POST(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { request_id } = await request.json();
  if (!request_id) return NextResponse.json({ error: "Missing request_id." }, { status: 400 });

  const db = createServiceClient();
  const { data: req } = await db
    .from("container_pickup_requests")
    .select("container_photo_path")
    .eq("id", request_id)
    .single();

  if (!req?.container_photo_path) return NextResponse.json({ missing: true });

  const { data: signedUrl, error } = await db.storage
    .from("nonprofit-docs")
    .createSignedUrl(req.container_photo_path, 300);

  if (error || !signedUrl) return NextResponse.json({ missing: true });

  return NextResponse.json({ url: signedUrl.signedUrl });
}

// DELETE — remove a container request
export async function DELETE(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const db = createServiceClient();
  const { error } = await db.from("container_pickup_requests").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Delete failed." }, { status: 500 });

  return NextResponse.json({ success: true });
}
