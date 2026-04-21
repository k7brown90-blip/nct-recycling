"use client";

import { useEffect, useState } from "react";
import { WORK_CALENDAR_DAYS, WORK_CALENDAR_MONTHS, buildWorkCalendarGrid, getWorkCalendarDateString } from "@/lib/work-calendar";

function formatCalendarShiftWindow(shift) {
  return `${new Date(shift.scheduled_start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - ${new Date(shift.scheduled_end).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

export default function EmployeeWorkCalendar({ employee, initialCalendarMonth, initialCalendarShifts }) {
  const [calendarMonth, setCalendarMonth] = useState(initialCalendarMonth);
  const [calendarShifts, setCalendarShifts] = useState(initialCalendarShifts || []);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    getWorkCalendarDateString(initialCalendarMonth.year, initialCalendarMonth.month, new Date().getMonth() === initialCalendarMonth.month && new Date().getFullYear() === initialCalendarMonth.year ? new Date().getDate() : 1)
  );

  useEffect(() => {
    setSelectedDate(getWorkCalendarDateString(calendarMonth.year, calendarMonth.month, 1));
  }, [calendarMonth]);

  async function loadMonth(year, month) {
    setCalendarLoading(true);
    const res = await fetch(`/api/employee/schedule?year=${year}&month=${month}`);
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      setCalendarShifts(json.shifts || []);
    }
    setCalendarLoading(false);
  }

  function changeMonth(direction) {
    const nextDate = new Date(calendarMonth.year, calendarMonth.month + direction, 1);
    const nextMonth = { year: nextDate.getFullYear(), month: nextDate.getMonth() };
    setCalendarMonth(nextMonth);
    loadMonth(nextMonth.year, nextMonth.month);
  }

  const weeks = buildWorkCalendarGrid(calendarMonth.year, calendarMonth.month);
  const selectedDateShifts = calendarShifts.filter((shift) => shift.shift_date === selectedDate);
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-bold text-nct-navy">Work Calendar</h2>
          <p className="text-sm text-gray-500 mt-1">Shared team schedule visible to employees and admin.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => changeMonth(-1)} className="px-3 py-1.5 rounded-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700">Prev</button>
          <p className="min-w-[150px] text-center text-sm font-semibold text-nct-navy">{WORK_CALENDAR_MONTHS[calendarMonth.month]} {calendarMonth.year}</p>
          <button type="button" onClick={() => changeMonth(1)} className="px-3 py-1.5 rounded-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700">Next</button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="grid grid-cols-7 gap-2 mb-2">
            {WORK_CALENDAR_DAYS.map((label) => (
              <div key={label} className="text-xs font-semibold uppercase tracking-wide text-gray-400 px-2 py-1">{label}</div>
            ))}
          </div>
          <div className="space-y-2">
            {weeks.map((week, weekIndex) => (
              <div key={`${calendarMonth.year}-${calendarMonth.month}-week-${weekIndex}`} className="grid grid-cols-7 gap-2">
                {week.map((day, dayIndex) => {
                  if (!day) {
                    return <div key={`empty-${weekIndex}-${dayIndex}`} className="min-h-[104px] rounded-xl bg-gray-50 border border-transparent" />;
                  }

                  const dateKey = getWorkCalendarDateString(calendarMonth.year, calendarMonth.month, day);
                  const dayShifts = calendarShifts.filter((shift) => shift.shift_date === dateKey);
                  const isSelected = selectedDate === dateKey;
                  const isToday = todayKey === dateKey;
                  const ownShift = dayShifts.some((shift) => shift.employee_id === employee?.id);

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => setSelectedDate(dateKey)}
                      className={`min-h-[104px] rounded-xl border p-2 text-left transition-colors ${isSelected ? "border-nct-gold bg-yellow-50" : ownShift ? "border-blue-200 bg-blue-50" : isToday ? "border-nct-navy bg-slate-50" : "border-gray-200 bg-white hover:border-nct-gold/60"}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-nct-navy">{day}</span>
                        <span className="text-[11px] text-gray-400">{dayShifts.length || "Open"}</span>
                      </div>
                      <div className="space-y-1">
                        {dayShifts.slice(0, 2).map((shift) => (
                          <div key={shift.id} className={`rounded-lg px-2 py-1 ${shift.employee_id === employee?.id ? "bg-blue-100" : "bg-slate-100"}`}>
                            <p className="text-[11px] font-semibold text-nct-navy truncate">{shift.display_name}</p>
                            <p className="text-[10px] text-gray-500 truncate">{shift.role_label || shift.job_title || "Shift"}</p>
                          </div>
                        ))}
                        {dayShifts.length > 2 && <p className="text-[10px] text-gray-500">+{dayShifts.length - 2} more</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 p-4 bg-slate-50">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-nct-gold mb-1">Selected Day</p>
              <h3 className="text-lg font-bold text-nct-navy">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h3>
            </div>
            {calendarLoading && <span className="text-xs text-gray-500">Loading...</span>}
          </div>

          {selectedDateShifts.length === 0 ? (
            <p className="text-sm text-gray-500">No shifts are assigned for this day yet.</p>
          ) : (
            <div className="space-y-3">
              {selectedDateShifts.map((shift) => (
                <div key={shift.id} className={`rounded-xl border p-3 ${shift.employee_id === employee?.id ? "border-blue-200 bg-white" : "border-gray-200 bg-white"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-nct-navy">{shift.display_name}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{formatCalendarShiftWindow(shift)}</p>
                    </div>
                    {shift.employee_id === employee?.id && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Your shift</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{shift.role_label || shift.job_title || "Scheduled Shift"} · {shift.location_label || "NCT Recycling"}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}