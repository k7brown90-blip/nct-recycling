import { createServiceClient } from "@/lib/supabase";
import { getTeamCalendarMonth } from "@/lib/employee-profile";
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
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  const db = createServiceClient();

  if (Number.isInteger(year) && Number.isInteger(month) && month >= 0 && month <= 11) {
    const calendarData = await getTeamCalendarMonth(year, month, db);
    return NextResponse.json(calendarData);
  }

  if (!employeeId) {
    return NextResponse.json({ error: "employee_id or valid year/month is required." }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await db
    .from("employee_shifts")
    .select("id, employee_id, shift_date, scheduled_start, scheduled_end, status, notes, created_at")
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
    entry_type,
    employee_id,
    shift_date,
    start_time,
    end_time,
    ends_on,
    reason,
    admin_notes,
    notes,
  } = await request.json();

  if (entry_type === "time_off") {
    if (!employee_id || !shift_date || !ends_on) {
      return NextResponse.json({ error: "employee_id, start date, and end date are required for time off." }, { status: 400 });
    }
    if (new Date(`${ends_on}T12:00:00`).getTime() < new Date(`${shift_date}T12:00:00`).getTime()) {
      return NextResponse.json({ error: "Time-off end date must be on or after the start date." }, { status: 400 });
    }

    const db = createServiceClient();
    const { data, error } = await db
      .from("employee_time_off_requests")
      .insert({
        employee_id,
        request_type: "time_off",
        status: "approved",
        starts_on: shift_date,
        ends_on,
        reason: reason || "Admin scheduled time off",
        admin_notes: admin_notes || null,
        reviewed_at: new Date().toISOString(),
      })
      .select("id, employee_id, starts_on, ends_on, status, reason, admin_notes")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, timeOffBlock: data });
  }

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
      notes: notes || null,
    })
    .select("id, employee_id, shift_date, scheduled_start, scheduled_end, status, notes")
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

  const { shift_id, time_off_id } = await request.json();
  if (!shift_id && !time_off_id) {
    return NextResponse.json({ error: "shift_id or time_off_id is required." }, { status: 400 });
  }

  const db = createServiceClient();

  if (time_off_id) {
    const { error } = await db
      .from("employee_time_off_requests")
      .update({ status: "cancelled" })
      .eq("id", time_off_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  const { error } = await db
    .from("employee_shifts")
    .update({ status: "cancelled" })
    .eq("id", shift_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}