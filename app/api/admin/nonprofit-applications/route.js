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

  const { id, status, admin_notes } = await request.json();

  if (!id || !["approved", "denied", "pending"].includes(status)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("nonprofit_applications")
    .update({
      status,
      admin_notes: admin_notes || null,
      reviewed_by: "admin",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
