import { createServiceClient } from "@/lib/supabase";

function getNextDate(dateString) {
  const next = new Date(`${dateString}T12:00:00`);
  next.setDate(next.getDate() + 1);
  return next.toISOString().slice(0, 10);
}

function diffMinutes(startedAt, endedAt) {
  const diffMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return Math.max(Math.round(diffMs / 60000), 0);
}

function escapeCsvValue(value) {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export async function getPayrollExportEntries(periodStart, periodEnd, db = createServiceClient()) {
  const { data: rawEntries, error: entriesError } = await db
    .from("employee_time_entries")
    .select("id, employee_id, shift_id, entry_source, approval_status, started_at, ended_at, minutes_worked, notes, payroll_batch_id")
    .gte("started_at", `${periodStart}T00:00:00`)
    .lt("started_at", `${getNextDate(periodEnd)}T00:00:00`)
    .not("ended_at", "is", null)
    .is("payroll_batch_id", null)
    .neq("approval_status", "rejected")
    .order("started_at", { ascending: true });

  if (entriesError) {
    throw new Error(`Payroll entry lookup failed: ${entriesError.message}`);
  }

  const entries = (rawEntries || []).filter((entry) => entry.entry_source !== "manual" || entry.approval_status === "approved");
  if (entries.length === 0) {
    return {
      entries: [],
      summary: {
        periodStart,
        periodEnd,
        entryCount: 0,
        employeeCount: 0,
        totalMinutes: 0,
        totalHours: "0.00",
      },
    };
  }

  const employeeIds = [...new Set(entries.map((entry) => entry.employee_id).filter(Boolean))];
  const timeEntryIds = entries.map((entry) => entry.id);

  const [{ data: employees, error: employeesError }, { data: breaks, error: breaksError }] = await Promise.all([
    db
      .from("employee_profiles")
      .select("id, display_name, work_email, job_title, payroll_external_id, quickbooks_employee_id")
      .in("id", employeeIds),
    db
      .from("employee_break_entries")
      .select("time_entry_id, started_at, ended_at")
      .in("time_entry_id", timeEntryIds),
  ]);

  if (employeesError) {
    throw new Error(`Payroll employee lookup failed: ${employeesError.message}`);
  }
  if (breaksError) {
    throw new Error(`Payroll break lookup failed: ${breaksError.message}`);
  }

  const employeeMap = new Map((employees || []).map((employee) => [employee.id, employee]));
  const breakMinutesByEntryId = new Map();

  for (const entry of breaks || []) {
    if (!entry.time_entry_id || !entry.started_at || !entry.ended_at) continue;
    breakMinutesByEntryId.set(
      entry.time_entry_id,
      (breakMinutesByEntryId.get(entry.time_entry_id) || 0) + diffMinutes(entry.started_at, entry.ended_at),
    );
  }

  const exportEntries = entries.map((entry) => {
    const employee = employeeMap.get(entry.employee_id) || {};
    const minutesWorked = entry.minutes_worked || 0;
    return {
      ...entry,
      employee_name: employee.display_name || "Employee",
      display_name: employee.display_name || "Employee",
      work_email: employee.work_email || "",
      job_title: employee.job_title || "",
      payroll_external_id: employee.payroll_external_id || "",
      quickbooks_employee_id: employee.quickbooks_employee_id || "",
      break_minutes: breakMinutesByEntryId.get(entry.id) || 0,
      hours_worked: (minutesWorked / 60).toFixed(2),
      work_date: entry.started_at?.slice(0, 10) || "",
    };
  });

  const totalMinutes = exportEntries.reduce((sum, entry) => sum + (entry.minutes_worked || 0), 0);

  return {
    entries: exportEntries,
    summary: {
      periodStart,
      periodEnd,
      entryCount: exportEntries.length,
      employeeCount: new Set(exportEntries.map((entry) => entry.employee_id)).size,
      totalMinutes,
      totalHours: (totalMinutes / 60).toFixed(2),
    },
  };
}

export function buildPayrollCsv(entries) {
  const columns = [
    "employee_name",
    "work_email",
    "job_title",
    "payroll_external_id",
    "quickbooks_employee_id",
    "entry_source",
    "approval_status",
    "work_date",
    "started_at",
    "ended_at",
    "minutes_worked",
    "hours_worked",
    "break_minutes",
    "notes",
  ];

  const rows = entries.map((entry) => columns.map((column) => escapeCsvValue(entry[column])));
  return [columns.join(","), ...rows.map((row) => row.join(","))].join("\n");
}