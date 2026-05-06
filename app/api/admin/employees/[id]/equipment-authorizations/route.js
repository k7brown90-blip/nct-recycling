import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

const VALID_TYPES = ["baler", "forklift", "other"];

// GET — list authorizations for an employee (active + revoked).
export async function GET(request, { params }) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id: employeeId } = await params;
  if (!employeeId) {
    return NextResponse.json({ error: "Missing employee id." }, { status: 400 });
  }
  const db = createServiceClient();
  const { data, error } = await db
    .from("equipment_authorizations")
    .select(
      "id, equipment_type, equipment_label, authorized_at, authorized_by_label, expires_at, revoked_at, revoked_reason, notes, created_at",
    )
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Equipment auth list error:", error);
    return NextResponse.json({ error: "Failed to fetch." }, { status: 500 });
  }
  return NextResponse.json({ authorizations: data || [] });
}

// POST — grant a new authorization.
export async function POST(request, { params }) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id: employeeId } = await params;
  if (!employeeId) {
    return NextResponse.json({ error: "Missing employee id." }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const equipmentType = body?.equipment_type;
  if (!VALID_TYPES.includes(equipmentType)) {
    return NextResponse.json(
      { error: `equipment_type must be one of: ${VALID_TYPES.join(", ")}.` },
      { status: 400 },
    );
  }

  const equipmentLabel = body?.equipment_label?.toString().trim() || null;
  const authorizedByLabel = body?.authorized_by_label?.toString().trim() || "Admin";
  const notes = body?.notes?.toString().trim() || null;

  // Default expiry: forklift = 36 months from now per 29 CFR 1910.178(l)(4)(iii);
  // baler = 36 months by NCT policy; other = no expiry unless caller provides one.
  let expiresAt = body?.expires_at || null;
  if (!expiresAt && (equipmentType === "forklift" || equipmentType === "baler")) {
    const d = new Date();
    d.setMonth(d.getMonth() + 36);
    expiresAt = d.toISOString();
  }

  const db = createServiceClient();

  const { data: employee, error: empErr } = await db
    .from("employee_profiles")
    .select("id")
    .eq("id", employeeId)
    .maybeSingle();
  if (empErr) {
    return NextResponse.json({ error: "Employee lookup failed." }, { status: 500 });
  }
  if (!employee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  const { data, error } = await db
    .from("equipment_authorizations")
    .insert({
      employee_id: employeeId,
      equipment_type: equipmentType,
      equipment_label: equipmentLabel,
      authorized_by_label: authorizedByLabel,
      expires_at: expiresAt,
      notes,
    })
    .select(
      "id, equipment_type, equipment_label, authorized_at, expires_at, authorized_by_label, notes",
    )
    .single();

  if (error) {
    console.error("Equipment auth grant error:", error);
    return NextResponse.json({ error: "Failed to grant." }, { status: 500 });
  }
  return NextResponse.json({ authorization: data });
}

// DELETE — revoke an authorization (soft delete by setting revoked_at).
export async function DELETE(request, { params }) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id: employeeId } = await params;
  const { searchParams } = new URL(request.url);
  const authId = searchParams.get("authorizationId");
  if (!employeeId || !authId) {
    return NextResponse.json(
      { error: "Missing employee id or authorizationId." },
      { status: 400 },
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const reason = body?.reason?.toString().trim() || "Revoked by admin";

  const db = createServiceClient();
  const { error } = await db
    .from("equipment_authorizations")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: reason,
    })
    .eq("id", authId)
    .eq("employee_id", employeeId)
    .is("revoked_at", null);

  if (error) {
    console.error("Equipment auth revoke error:", error);
    return NextResponse.json({ error: "Failed to revoke." }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
