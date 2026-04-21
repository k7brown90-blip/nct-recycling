import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { activateEmployeeProfileByUserId, getEmployeeDashboardSnapshot } from "@/lib/employee-profile";
import { NextResponse } from "next/server";

function diffMinutes(startedAt, endedAt) {
  const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return Math.max(Math.round(diffMs / 60000), 0);
}

function getNextDate(dateString) {
  const next = new Date(`${dateString}T12:00:00`);
  next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
}

async function getEmployeeContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);
  if (profile?.role !== "employee") return null;

  const employee = await activateEmployeeProfileByUserId(user.id, db);
  if (!employee?.id) return null;

  return { user, employee, db };
}

export async function POST(request) {
  const context = await getEmployeeContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { work_date, start_time, end_time, notes } = await request.json();
  if (!work_date || !start_time || !end_time) {
    return NextResponse.json({ error: "Work date, start time, and end time are required." }, { status: 400 });
  }
  if (!notes || typeof notes !== "string" || notes.trim().length < 5) {
    return NextResponse.json({ error: "A brief note explaining the manual entry is required." }, { status: 400 });
  }

  const startedAt = `${work_date}T${start_time}:00`;
  const endedAt = `${work_date}T${end_time}:00`;
  if (new Date(endedAt).getTime() <= new Date(startedAt).getTime()) {
    return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
  }

  const { user, employee, db } = context;
  const { data: existingEntries, error: existingError } = await db
    .from("employee_time_entries")
    .select("id, started_at, ended_at")
    .eq("employee_id", employee.id)
    .gte("started_at", `${work_date}T00:00:00`)
    .lt("started_at", `${getNextDate(work_date)}T00:00:00`);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const overlaps = (existingEntries || []).some((entry) => {
    const entryEnd = entry.ended_at || entry.started_at;
    return new Date(entry.started_at).getTime() < new Date(endedAt).getTime()
      && new Date(entryEnd).getTime() > new Date(startedAt).getTime();
  });

  if (overlaps) {
    return NextResponse.json({ error: "This manual entry overlaps an existing time entry." }, { status: 409 });
  }

  const { error: insertError } = await db.from("employee_time_entries").insert({
    employee_id: employee.id,
    entry_source: "manual",
    approval_status: "pending",
    started_at: startedAt,
    ended_at: endedAt,
    minutes_worked: diffMinutes(startedAt, endedAt),
    notes: notes.trim(),
    submitted_by: user.id,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const snapshot = await getEmployeeDashboardSnapshot(employee.id, db);
  return NextResponse.json({
    success: true,
    employee,
    ...snapshot,
  });
}