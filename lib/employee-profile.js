import { createServiceClient } from "@/lib/supabase";

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

  return {
    activeTimeEntry: activeTimeEntry || null,
    openBreak,
    upcomingShifts: upcomingShifts || [],
    recentEntries: recentEntries || [],
  };
}