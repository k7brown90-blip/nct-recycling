import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

// GET — donation lots, optionally filtered by application_id
export async function GET(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const application_id = searchParams.get("application_id");

  const db = createServiceClient();
  let query = db
    .from("tax_receipts")
    .select("*, nonprofit_applications(id, org_name, email, contact_name)")
    .order("lot_date", { ascending: false });

  if (application_id) query = query.eq("application_id", application_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  return NextResponse.json({ lots: data });
}

// POST — admin logs a donation lot for a nonprofit
export async function POST(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { application_id, piece_count, lot_date, notes } = await request.json();

  if (!application_id || !piece_count || piece_count < 1) {
    return NextResponse.json({ error: "application_id and piece_count are required." }, { status: 400 });
  }

  const db = createServiceClient();

  // Verify nonprofit exists and is approved
  const { data: app } = await db
    .from("nonprofit_applications")
    .select("id, org_name")
    .eq("id", application_id)
    .eq("status", "approved")
    .single();

  if (!app) {
    return NextResponse.json({ error: "Nonprofit not found or not approved." }, { status: 404 });
  }

  const total_value = (piece_count * 5).toFixed(2);

  const { data, error } = await db.from("tax_receipts").insert({
    application_id,
    piece_count: parseInt(piece_count),
    total_value,
    lot_date: lot_date || new Date().toISOString().split("T")[0],
    notes: notes || null,
    receipt_status: "pending_receipt",
    file_url: null,
  }).select("id").single();

  if (error) {
    console.error("Tax receipt insert error:", error);
    return NextResponse.json({ error: "Failed to create lot." }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id });
}

// PATCH — get a signed URL to view an uploaded receipt (admin)
export async function PATCH(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const db = createServiceClient();
  const { data: lot } = await db.from("tax_receipts").select("receipt_file_path").eq("id", id).single();
  if (!lot?.receipt_file_path) return NextResponse.json({ error: "No receipt uploaded." }, { status: 404 });

  const { data: signedUrl, error } = await db.storage
    .from("nonprofit-docs")
    .createSignedUrl(lot.receipt_file_path, 300);

  if (error || !signedUrl) return NextResponse.json({ error: "Could not generate link." }, { status: 500 });

  return NextResponse.json({ url: signedUrl.signedUrl });
}

// DELETE — remove a donation lot
export async function DELETE(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const db = createServiceClient();
  const { error } = await db.from("tax_receipts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Delete failed." }, { status: 500 });

  return NextResponse.json({ success: true });
}
