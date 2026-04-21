"use client";

import { useEffect, useState } from "react";
import EmployeeWorkCalendar from "@/components/EmployeeWorkCalendar";
import SignOutButton from "@/components/SignOutButton";

function formatDateTime(value) {
  if (!value) return "Not clocked in";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShiftWindow(shift) {
  const start = new Date(shift.scheduled_start);
  const end = new Date(shift.scheduled_end);
  return `${start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function formatMinutes(minutes) {
  if (!minutes && minutes !== 0) return "Pending";
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (!hours) return `${remaining}m`;
  if (!remaining) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

function getClockStatus(employee, activeTimeEntry, openBreak) {
  if (openBreak) return { label: "On Break", detail: formatDateTime(openBreak.started_at) };
  if (activeTimeEntry) return { label: "Clocked In", detail: formatDateTime(activeTimeEntry.started_at) };
  return {
    label: employee?.last_clock_event_type === "clock_out" ? "Clocked Out" : "Awaiting Shift",
    detail: formatDateTime(employee?.last_clock_event_at),
  };
}

export default function EmployeeDashboardClient({ employee, initialSnapshot, initialCalendarMonth, initialCalendarData }) {
  const [state, setState] = useState(initialSnapshot);
  const [employeeState, setEmployeeState] = useState(employee);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState(null);
  const [selectedShiftId, setSelectedShiftId] = useState(initialSnapshot.clockableShifts?.[0]?.id || "");
  const [manualEntrySaving, setManualEntrySaving] = useState(false);
  const [manualEntryForm, setManualEntryForm] = useState({
    work_date: new Date().toISOString().slice(0, 10),
    start_time: "09:00",
    end_time: "17:00",
    notes: "",
  });

  const clockStatus = getClockStatus(employeeState, state.activeTimeEntry, state.openBreak);

  useEffect(() => {
    if (!state.clockableShifts?.length) {
      setSelectedShiftId("");
      return;
    }

    if (!state.clockableShifts.some((shift) => shift.id === selectedShiftId)) {
      setSelectedShiftId(state.clockableShifts[0].id);
    }
  }, [state.clockableShifts, selectedShiftId]);

  async function runClockAction(action) {
    setBusyAction(action);
    setError("");
    setMessage("");

    const res = await fetch("/api/employee/time-clock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, shift_id: action === "clock_in" ? selectedShiftId : undefined }),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(json.error || "Action failed.");
      setBusyAction(null);
      return;
    }

    setEmployeeState(json.employee || employeeState);
    setState({
      activeTimeEntry: json.activeTimeEntry || null,
      openBreak: json.openBreak || null,
      clockableShifts: json.clockableShifts || [],
      upcomingShifts: json.upcomingShifts || [],
      recentEntries: json.recentEntries || [],
    });
    setMessage(
      action === "clock_in"
        ? "Clock in recorded."
        : action === "break_start"
          ? "Break started."
          : action === "break_end"
            ? "Break ended."
            : "Clock out recorded."
    );
    setBusyAction(null);
  }

  async function submitManualEntry(e) {
    e.preventDefault();
    setManualEntrySaving(true);
    setError("");
    setMessage("");

    const res = await fetch("/api/employee/manual-time", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manualEntryForm),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(json.error || "Manual time entry failed.");
      setManualEntrySaving(false);
      return;
    }

    setEmployeeState(json.employee || employeeState);
    setState({
      activeTimeEntry: json.activeTimeEntry || null,
      openBreak: json.openBreak || null,
      clockableShifts: json.clockableShifts || [],
      upcomingShifts: json.upcomingShifts || [],
      recentEntries: json.recentEntries || [],
    });
    setManualEntryForm((current) => ({ ...current, notes: "" }));
    setMessage("Manual time entry submitted for admin review.");
    setManualEntrySaving(false);
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-nct-gold mb-2">
            Internal Workforce
          </p>
          <h1 className="text-3xl font-bold text-nct-navy">
            {employeeState?.display_name || employeeState?.work_email || "Employee Portal"}
          </h1>
          <p className="text-gray-500 mt-1">
            Employee labor state is now live: clock activity and assigned shifts are shown here.
          </p>
        </div>
        <SignOutButton />
      </div>

      {(message || error) && (
        <div className={`rounded-lg p-3 text-sm mb-4 ${error ? "bg-red-50 border border-red-300 text-red-700" : "bg-green-50 border border-green-300 text-green-700"}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <section className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Role</p>
          <p className="text-lg font-bold text-nct-navy">{employeeState?.job_title || "Employee"}</p>
          <p className="text-sm text-gray-500 mt-2">{employeeState?.employment_status || "pending_setup"}</p>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Primary Location</p>
          <p className="text-lg font-bold text-nct-navy">{employeeState?.primary_location || "NCT Recycling"}</p>
          <p className="text-sm text-gray-500 mt-2">{employeeState?.work_email || "No work email on file"}</p>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Clock Status</p>
          <p className="text-lg font-bold text-nct-navy">{clockStatus.label}</p>
          <p className="text-sm text-gray-500 mt-2">{clockStatus.detail}</p>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] mb-6">
        <section className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-nct-navy">Time Clock</h2>
              <p className="text-sm text-gray-500 mt-1">Clock in, track breaks, and close out your shift.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {!state.activeTimeEntry ? (
              <>
                <select
                  value={selectedShiftId}
                  onChange={(e) => setSelectedShiftId(e.target.value)}
                  disabled={busyAction !== null || state.clockableShifts.length === 0}
                  className="border border-gray-300 rounded-xl px-4 py-3 bg-white text-nct-navy disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">Select assigned shift</option>
                  {state.clockableShifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {formatShiftWindow(shift)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => runClockAction("clock_in")}
                  disabled={busyAction !== null || !selectedShiftId}
                  className="bg-nct-navy hover:opacity-90 text-white font-bold py-3 rounded-xl transition-opacity disabled:opacity-50"
                >
                  {busyAction === "clock_in" ? "Clocking in..." : "Clock In To Assigned Shift"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => runClockAction(state.openBreak ? "break_end" : "break_start")}
                  disabled={busyAction !== null}
                  className="bg-white border border-gray-300 hover:border-nct-navy text-nct-navy font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  {busyAction === "break_start" || busyAction === "break_end"
                    ? (state.openBreak ? "Ending break..." : "Starting break...")
                    : (state.openBreak ? "End Break" : "Start Break")}
                </button>
                <button
                  type="button"
                  onClick={() => runClockAction("clock_out")}
                  disabled={busyAction !== null}
                  className="bg-nct-gold hover:bg-yellow-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  {busyAction === "clock_out" ? "Clocking out..." : "Clock Out"}
                </button>
              </>
            )}
          </div>

          {!state.activeTimeEntry && state.clockableShifts.length === 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4">
              You can only clock in when you have an assigned shift for today.
            </p>
          )}

          <div className="mt-5 grid gap-3 md:grid-cols-2 text-sm text-gray-700">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Current Entry</p>
              <p className="font-semibold text-nct-navy">
                {state.activeTimeEntry ? formatDateTime(state.activeTimeEntry.started_at) : "No active time entry"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Break State</p>
              <p className="font-semibold text-nct-navy">
                {state.openBreak ? `On ${state.openBreak.break_type} break since ${formatDateTime(state.openBreak.started_at)}` : "No active break"}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-nct-navy mb-3">Upcoming Shifts</h2>
          {state.upcomingShifts.length === 0 ? (
            <p className="text-sm text-gray-500">No upcoming shifts have been assigned yet.</p>
          ) : (
            <div className="space-y-3">
              {state.upcomingShifts.map((shift) => (
                <div key={shift.id} className="rounded-xl border border-gray-200 p-4">
                  <p className="font-semibold text-nct-navy">Assigned Shift</p>
                  <p className="text-sm text-gray-500 mt-1">{formatShiftWindow(shift)}</p>
                  <div className="flex items-center justify-between mt-2 text-sm text-gray-600 gap-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{shift.status}</span>
                  </div>
                  {shift.notes && <p className="text-xs text-gray-500 mt-2">{shift.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <EmployeeWorkCalendar
        employee={employeeState}
        initialCalendarMonth={initialCalendarMonth}
        initialCalendarData={initialCalendarData}
      />

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-nct-navy mb-3">Manual Time Entry</h2>
          <p className="text-sm text-gray-500 mb-4">Submit a missed shift or correction for admin approval.</p>
          <form onSubmit={submitManualEntry} className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={manualEntryForm.work_date}
                onChange={(e) => setManualEntryForm((current) => ({ ...current, work_date: e.target.value }))}
                className="border border-gray-300 rounded-lg px-4 py-2"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="time"
                  value={manualEntryForm.start_time}
                  onChange={(e) => setManualEntryForm((current) => ({ ...current, start_time: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-4 py-2"
                />
                <input
                  type="time"
                  value={manualEntryForm.end_time}
                  onChange={(e) => setManualEntryForm((current) => ({ ...current, end_time: e.target.value }))}
                  className="border border-gray-300 rounded-lg px-4 py-2"
                />
              </div>
            </div>
            <textarea
              value={manualEntryForm.notes}
              onChange={(e) => setManualEntryForm((current) => ({ ...current, notes: e.target.value }))}
              placeholder="Explain why this manual entry is needed"
              rows={4}
              className="border border-gray-300 rounded-lg px-4 py-2"
            />
            <button
              type="submit"
              disabled={manualEntrySaving}
              className="bg-nct-navy hover:opacity-90 text-white font-bold py-3 rounded-xl transition-opacity disabled:opacity-50"
            >
              {manualEntrySaving ? "Submitting..." : "Submit For Approval"}
            </button>
          </form>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-nct-navy mb-3">Recent Time Entries</h2>
          {state.recentEntries.length === 0 ? (
            <p className="text-sm text-gray-500">No completed time entries yet.</p>
          ) : (
            <div className="space-y-3">
              {state.recentEntries.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-nct-navy">{formatDateTime(entry.started_at)}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {entry.ended_at ? `${formatDateTime(entry.ended_at)} end` : "Pending end time"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-nct-navy">{formatMinutes(entry.minutes_worked)}</p>
                    <p className="text-xs text-gray-500 mt-1">{entry.approval_status}</p>
                    <p className="text-xs text-gray-400 mt-1">{entry.entry_source}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}