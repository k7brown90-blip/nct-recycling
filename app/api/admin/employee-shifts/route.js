import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

function formatShiftDate(dateValue) {
  return new Date(`${dateValue}T12:00:00`).toISOString().slice(0, 10);
}

export async function GET(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employee_id");
  if (!employeeId) {
    return NextResponse.json({ error: "employee_id is required." }, { status: 400 });
  }

  const db = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await db
    .from("employee_shifts")
    .select("id, employee_id, shift_date, scheduled_start, scheduled_end, status, role_label, location_label, notes, created_at")
    .eq("employee_id", employeeId)
    .gte("shift_date", today)
    .in("status", ["draft", "scheduled", "confirmed"])
    .order("scheduled_start", { ascending: true })
    .limit(8);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ shifts: data || [] });
}

export async function POST(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const {
    employee_id,
    shift_date,
    start_time,
    end_time,
    role_label,
    location_label,
    notes,
  } = await request.json();

  if (!employee_id || !shift_date || !start_time || !end_time) {
    return NextResponse.json({ error: "employee_id, shift_date, start_time, and end_time are required." }, { status: 400 });
  }

  const normalizedDate = formatShiftDate(shift_date);
  const scheduledStart = `${normalizedDate}T${start_time}:00`;
  const scheduledEnd = `${normalizedDate}T${end_time}:00`;

  if (new Date(scheduledEnd).getTime() <= new Date(scheduledStart).getTime()) {
    return NextResponse.json({ error: "Shift end time must be after the start time." }, { status: 400 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("employee_shifts")
    .insert({
      employee_id,
      shift_date: normalizedDate,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      status: "scheduled",
      role_label: role_label || null,
      location_label: location_label || null,
      notes: notes || null,
    })
    .select("id, employee_id, shift_date, scheduled_start, scheduled_end, status, role_label, location_label, notes")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, shift: data });
}

export async function DELETE(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { shift_id } = await request.json();
  if (!shift_id) {
    return NextResponse.json({ error: "shift_id is required." }, { status: 400 });
  }

  const db = createServiceClient();
  const { error } = await db
    .from("employee_shifts")
    .update({ status: "cancelled" })
    .eq("id", shift_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}