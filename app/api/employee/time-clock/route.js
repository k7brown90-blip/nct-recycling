import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { activateEmployeeProfileByUserId, getEmployeeDashboardSnapshot } from "@/lib/employee-profile";
import { NextResponse } from "next/server";

const VALID_ACTIONS = new Set(["clock_in", "break_start", "break_end", "clock_out"]);

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

function diffMinutes(startedAt, endedAt) {
  const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return Math.max(Math.round(diffMs / 60000), 0);
}

async function getActiveEntry(employeeId, db) {
  const { data, error } = await db
    .from("employee_time_entries")
    .select("id, started_at")
    .eq("employee_id", employeeId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Active clock entry lookup failed: ${error.message}`);
  }

  return data || null;
}

async function getOpenBreak(timeEntryId, db) {
  const { data, error } = await db
    .from("employee_break_entries")
    .select("id, started_at")
    .eq("time_entry_id", timeEntryId)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Open break lookup failed: ${error.message}`);
  }

  return data || null;
}

async function getAssignedShiftForClockIn(employeeId, shiftId, currentDate, db) {
  const { data: shift, error: shiftError } = await db
    .from("employee_shifts")
    .select("id, shift_date, scheduled_start, scheduled_end, status, notes")
    .eq("id", shiftId)
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (shiftError) {
    throw new Error(`Assigned shift lookup failed: ${shiftError.message}`);
  }

  if (!shift) {
    return { error: "You can only clock into a shift assigned to you." };
  }
  if (shift.shift_date !== currentDate) {
    return { error: "You can only clock into a shift scheduled for today." };
  }
  if (!["draft", "scheduled", "confirmed"].includes(shift.status)) {
    return { error: "This shift is not available for clock in." };
  }

  const { data: existingEntry, error: existingEntryError } = await db
    .from("employee_time_entries")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("shift_id", shift.id)
    .limit(1)
    .maybeSingle();

  if (existingEntryError) {
    throw new Error(`Shift entry lookup failed: ${existingEntryError.message}`);
  }

  if (existingEntry?.id) {
    return { error: "A time entry already exists for this assigned shift." };
  }

  return { shift };
}

async function setEmployeeClockMarker(employeeId, eventType, eventAt, db) {
  const { error } = await db
    .from("employee_profiles")
    .update({
      last_clock_event_type: eventType,
      last_clock_event_at: eventAt,
    })
    .eq("id", employeeId);

  if (error) {
    throw new Error(`Employee clock marker update failed: ${error.message}`);
  }
}

export async function GET() {
  const context = await getEmployeeContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const snapshot = await getEmployeeDashboardSnapshot(context.employee.id, context.db);
  return NextResponse.json({
    employee: context.employee,
    ...snapshot,
  });
}

export async function POST(request) {
  const context = await getEmployeeContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { action, shift_id } = await request.json();
  if (!action) {
    return NextResponse.json({ error: "Action is required." }, { status: 400 });
  }
  if (!VALID_ACTIONS.has(action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const { user, employee, db } = context;
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const activeEntry = await getActiveEntry(employee.id, db);

  if (action === "clock_in") {
    if (activeEntry) {
      return NextResponse.json({ error: "You are already clocked in." }, { status: 409 });
    }

    if (!shift_id) {
      return NextResponse.json({ error: "Select your assigned shift before clocking in." }, { status: 400 });
    }

    const assignedShift = await getAssignedShiftForClockIn(employee.id, shift_id, today, db);
    if (assignedShift.error) {
      return NextResponse.json({ error: assignedShift.error }, { status: 409 });
    }

    const { error } = await db.from("employee_time_entries").insert({
      employee_id: employee.id,
      shift_id: assignedShift.shift.id,
      entry_source: "clock",
      approval_status: "pending",
      started_at: now,
      submitted_by: user.id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await setEmployeeClockMarker(employee.id, "clock_in", now, db);
  }

  if (action === "break_start") {
    if (!activeEntry) {
      return NextResponse.json({ error: "You must clock in before starting a break." }, { status: 409 });
    }

    const openBreak = await getOpenBreak(activeEntry.id, db);
    if (openBreak) {
      return NextResponse.json({ error: "You already have an active break." }, { status: 409 });
    }

    const { error } = await db.from("employee_break_entries").insert({
      time_entry_id: activeEntry.id,
      break_type: "unpaid",
      started_at: now,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await setEmployeeClockMarker(employee.id, "break_start", now, db);
  }

  if (action === "break_end") {
    if (!activeEntry) {
      return NextResponse.json({ error: "You do not have an active shift." }, { status: 409 });
    }

    const openBreak = await getOpenBreak(activeEntry.id, db);
    if (!openBreak) {
      return NextResponse.json({ error: "There is no active break to end." }, { status: 409 });
    }

    const { error } = await db
      .from("employee_break_entries")
      .update({ ended_at: now })
      .eq("id", openBreak.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await setEmployeeClockMarker(employee.id, "break_end", now, db);
  }

  if (action === "clock_out") {
    if (!activeEntry) {
      return NextResponse.json({ error: "You are not currently clocked in." }, { status: 409 });
    }

    const openBreak = await getOpenBreak(activeEntry.id, db);
    if (openBreak) {
      const { error: closeBreakError } = await db
        .from("employee_break_entries")
        .update({ ended_at: now })
        .eq("id", openBreak.id);

      if (closeBreakError) {
        return NextResponse.json({ error: closeBreakError.message }, { status: 500 });
      }
    }

    const { data: breaks, error: breaksError } = await db
      .from("employee_break_entries")
      .select("started_at, ended_at")
      .eq("time_entry_id", activeEntry.id);

    if (breaksError) {
      return NextResponse.json({ error: breaksError.message }, { status: 500 });
    }

    const breakMinutes = (breaks || []).reduce((sum, entry) => {
      if (!entry.started_at || !entry.ended_at) return sum;
      return sum + diffMinutes(entry.started_at, entry.ended_at);
    }, 0);

    const minutesWorked = Math.max(diffMinutes(activeEntry.started_at, now) - breakMinutes, 0);
    const { error: clockOutError } = await db
      .from("employee_time_entries")
      .update({
        ended_at: now,
        minutes_worked: minutesWorked,
      })
      .eq("id", activeEntry.id);

    if (clockOutError) {
      return NextResponse.json({ error: clockOutError.message }, { status: 500 });
    }

    await setEmployeeClockMarker(employee.id, "clock_out", now, db);
  }

  const snapshot = await getEmployeeDashboardSnapshot(employee.id, db);
  return NextResponse.json({
    success: true,
    employee: {
      ...employee,
      last_clock_event_type: action,
      last_clock_event_at: now,
    },
    ...snapshot,
  });
}