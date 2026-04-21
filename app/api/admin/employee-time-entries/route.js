import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

export async function GET(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";
  const db = createServiceClient();

  let query = db
    .from("employee_time_entries")
    .select("id, employee_id, shift_id, entry_source, approval_status, started_at, ended_at, minutes_worked, notes, created_at, approved_at")
    .eq("entry_source", "manual")
    .order("started_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("approval_status", status);
  }

  const { data: entries, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const employeeIds = [...new Set((entries || []).map((entry) => entry.employee_id).filter(Boolean))];
  let employeeMap = new Map();
  if (employeeIds.length > 0) {
    const { data: employees, error: employeeError } = await db
      .from("employee_profiles")
      .select("id, display_name, job_title")
      .in("id", employeeIds);

    if (employeeError) {
      return NextResponse.json({ error: employeeError.message }, { status: 500 });
    }

    employeeMap = new Map((employees || []).map((employee) => [employee.id, employee]));
  }

  return NextResponse.json({
    entries: (entries || []).map((entry) => ({
      ...entry,
      employee_display_name: employeeMap.get(entry.employee_id)?.display_name || "Employee",
      employee_job_title: employeeMap.get(entry.employee_id)?.job_title || null,
    })),
  });
}

export async function PATCH(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { entry_id, decision } = await request.json();
  if (!entry_id || !["approved", "rejected"].includes(decision)) {
    return NextResponse.json({ error: "entry_id and a valid decision are required." }, { status: 400 });
  }

  const payload = {
    approval_status: decision,
    approved_at: decision === "approved" ? new Date().toISOString() : null,
  };

  const db = createServiceClient();
  const { error } = await db
    .from("employee_time_entries")
    .update(payload)
    .eq("id", entry_id)
    .eq("entry_source", "manual");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}