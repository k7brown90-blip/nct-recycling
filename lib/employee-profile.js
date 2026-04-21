import { createServiceClient } from "@/lib/supabase";
import { getWorkCalendarMonthBounds } from "@/lib/work-calendar";

export async function getEmployeeProfileByUserId(userId, db = createServiceClient()) {
  if (!userId) return null;

  const { data, error } = await db
    .from("employee_profiles")
    .select("*")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Employee profile lookup failed: ${error.message}`);
  }

  return data;
}

export async function activateEmployeeProfileByUserId(userId, db = createServiceClient()) {
  const employee = await getEmployeeProfileByUserId(userId, db);

  if (!employee?.id || employee.employment_status !== "pending_setup") {
    return employee;
  }

  const { data, error } = await db
    .from("employee_profiles")
    .update({ employment_status: "active" })
    .eq("id", employee.id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Employee profile activation failed: ${error.message}`);
  }

  return data || employee;
}

export async function getEmployeeDashboardSnapshot(employeeId, db = createServiceClient()) {
  if (!employeeId) {
    return {
      activeTimeEntry: null,
      openBreak: null,
      clockableShifts: [],
      upcomingShifts: [],
      recentEntries: [],
    };
  }

  const today = new Date();
  const startDate = today.toISOString().slice(0, 10);

  const [
    { data: activeTimeEntry, error: activeError },
    { data: upcomingShifts, error: shiftsError },
    { data: recentEntries, error: recentError },
  ] = await Promise.all([
    db
      .from("employee_time_entries")
      .select("id, shift_id, entry_source, approval_status, started_at, ended_at, minutes_worked, notes")
      .eq("employee_id", employeeId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("employee_shifts")
      .select("id, shift_date, scheduled_start, scheduled_end, status, role_label, location_label, notes")
      .eq("employee_id", employeeId)
      .gte("shift_date", startDate)
      .in("status", ["draft", "scheduled", "confirmed"])
      .order("scheduled_start", { ascending: true })
      .limit(6),
    db
      .from("employee_time_entries")
      .select("id, shift_id, entry_source, approval_status, started_at, ended_at, minutes_worked, notes")
      .eq("employee_id", employeeId)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(5),
  ]);

  if (activeError) {
    throw new Error(`Active employee time entry lookup failed: ${activeError.message}`);
  }
  if (shiftsError) {
    throw new Error(`Employee shift lookup failed: ${shiftsError.message}`);
  }
  if (recentError) {
    throw new Error(`Recent employee entry lookup failed: ${recentError.message}`);
  }

  let openBreak = null;
  let clockableShifts = [];
  if (activeTimeEntry?.id) {
    const { data: breakEntry, error: breakError } = await db
      .from("employee_break_entries")
      .select("id, break_type, started_at, ended_at, notes")
      .eq("time_entry_id", activeTimeEntry.id)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (breakError) {
      throw new Error(`Active employee break lookup failed: ${breakError.message}`);
    }

    openBreak = breakEntry || null;
  }

  const todayShifts = (upcomingShifts || []).filter((shift) => shift.shift_date === startDate);
  if (todayShifts.length > 0) {
    const { data: existingShiftEntries, error: shiftEntriesError } = await db
      .from("employee_time_entries")
      .select("shift_id")
      .eq("employee_id", employeeId)
      .in("shift_id", todayShifts.map((shift) => shift.id));

    if (shiftEntriesError) {
      throw new Error(`Eligible employee shift lookup failed: ${shiftEntriesError.message}`);
    }

    const usedShiftIds = new Set((existingShiftEntries || []).map((entry) => entry.shift_id).filter(Boolean));
    clockableShifts = todayShifts.filter((shift) => !usedShiftIds.has(shift.id));
  }

  return {
    activeTimeEntry: activeTimeEntry || null,
    openBreak,
    clockableShifts,
    upcomingShifts: upcomingShifts || [],
    recentEntries: recentEntries || [],
  };
}

export async function getTeamScheduleMonth(year, monthIndex, db = createServiceClient()) {
  const { start, end } = getWorkCalendarMonthBounds(year, monthIndex);
  const { data, error } = await db
    .from("employee_schedule_overview")
    .select("id, shift_date, scheduled_start, scheduled_end, status, employee_id, display_name, job_title, department, default_shift_color")
    .gte("shift_date", start)
    .lte("shift_date", end)
    .neq("status", "cancelled")
    .order("scheduled_start", { ascending: true });

  if (error) {
    throw new Error(`Team schedule lookup failed: ${error.message}`);
  }

  return data || [];
}

export async function getTeamCalendarMonth(year, monthIndex, db = createServiceClient()) {
  const { start, end } = getWorkCalendarMonthBounds(year, monthIndex);

  const [shifts, { data: timeOffRows, error: timeOffError }] = await Promise.all([
    getTeamScheduleMonth(year, monthIndex, db),
    db
      .from("employee_time_off_requests")
      .select("id, employee_id, starts_on, ends_on, status, reason, admin_notes")
      .eq("request_type", "time_off")
      .eq("status", "approved")
      .lte("starts_on", end)
      .gte("ends_on", start)
      .order("starts_on", { ascending: true }),
  ]);

  if (timeOffError) {
    throw new Error(`Team time-off lookup failed: ${timeOffError.message}`);
  }

  const employeeIds = [...new Set((timeOffRows || []).map((entry) => entry.employee_id).filter(Boolean))];
  let employeeMap = new Map();

  if (employeeIds.length > 0) {
    const { data: employees, error: employeeError } = await db
      .from("employee_profiles")
      .select("id, display_name, job_title")
      .in("id", employeeIds);

    if (employeeError) {
      throw new Error(`Team time-off employee lookup failed: ${employeeError.message}`);
    }

    employeeMap = new Map((employees || []).map((employee) => [employee.id, employee]));
  }

  return {
    shifts,
    timeOffBlocks: (timeOffRows || []).map((entry) => ({
      ...entry,
      display_name: employeeMap.get(entry.employee_id)?.display_name || "Employee",
      job_title: employeeMap.get(entry.employee_id)?.job_title || null,
    })),
  };
}