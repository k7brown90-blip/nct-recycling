"use client";
import { useState, useEffect, useCallback } from "react";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

const TYPE_STYLES = {
  boutique:      { dot: "bg-nct-navy",  label: "Boutique" },
  bins_reseller: { dot: "bg-blue-500",  label: "Bins (Reseller)" },
  bins_public:   { dot: "bg-blue-300",  label: "Bins (Public)" },
  sunday_bins:   { dot: "bg-nct-gold",  label: "Sunday Bins" },
  closed:        { dot: "bg-red-400",   label: "Closed" },
};

function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function PublicCalendar() {
  const now = new Date();
  const [baseYear, setBaseYear] = useState(now.getFullYear());
  const [baseMonth, setBaseMonth] = useState(now.getMonth());
  const [events, setEvents] = useState({}); // { dateStr: [event, ...] }
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  const today = now.toISOString().split("T")[0];
  const secondMonth = baseMonth === 11 ? 0 : baseMonth + 1;
  const secondYear = baseMonth === 11 ? baseYear + 1 : baseYear;

  const loadEvents = useCallback(async (year, month) => {
    setLoading(true);
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const sm = month === 11 ? 0 : month + 1;
    const sy = month === 11 ? year + 1 : year;
    const lastDay = new Date(sy, sm + 1, 0).getDate();
    const end = `${sy}-${String(sm + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const res = await fetch(`/api/public/schedule?start=${start}&end=${end}`);
    if (res.ok) {
      const json = await res.json();
      const map = {};
      for (const ev of (json.events || [])) {
        if (!map[ev.date]) map[ev.date] = [];
        map[ev.date].push(ev);
      }
      setEvents((prev) => ({ ...prev, ...map }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEvents(baseYear, baseMonth);
  }, [baseYear, baseMonth, loadEvents]);

  function goBack() {
    if (baseMonth === 0) { setBaseMonth(11); setBaseYear(baseYear - 1); }
    else setBaseMonth(baseMonth - 1);
  }
  function goForward() {
    if (baseMonth === 11) { setBaseMonth(0); setBaseYear(baseYear + 1); }
    else setBaseMonth(baseMonth + 1);
  }

  const months = [
    { year: baseYear, month: baseMonth },
    { year: secondYear, month: secondMonth },
  ];

  const selectedEvents = selectedDate ? (events[selectedDate] || []) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={goBack} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-nct-navy font-bold text-lg">‹</button>
        <span className="font-bold text-nct-navy text-sm">
          {MONTH_NAMES[baseMonth]} — {MONTH_NAMES[secondMonth]} {secondYear}
        </span>
        <button onClick={goForward} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-nct-navy font-bold text-lg">›</button>
      </div>

      {loading && <p className="text-center text-sm text-gray-400 mb-4">Loading…</p>}

      <div className="space-y-5">
        {months.map(({ year, month }) => {
          const weeks = buildCalendarGrid(year, month);
          return (
            <div key={`${year}-${month}`} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-nct-navy text-white px-4 py-2">
                <p className="font-bold text-sm">{MONTH_NAMES[month]} {year}</p>
              </div>
              <div className="px-3 py-2">
                <div className="grid grid-cols-7 mb-1">
                  {DAY_LABELS.map((d) => (
                    <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
                  ))}
                </div>
                {weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7">
                    {week.map((day, di) => {
                      if (!day) return <div key={di} />;
                      const dateStr = toDateStr(year, month, day);
                      const dayEvents = events[dateStr] || [];
                      const isToday = dateStr === today;
                      const isFriSat = new Date(dateStr + "T12:00:00").getDay() === 5 || new Date(dateStr + "T12:00:00").getDay() === 6;
                      const isSelected = selectedDate === dateStr;
                      const hasBins = dayEvents.some((e) => e.type === "bins_reseller" || e.type === "bins_public" || e.type === "sunday_bins");
                      const isClosed = dayEvents.some((e) => e.type === "closed");
                      const hasBoutique = dayEvents.some((e) => e.type === "boutique");

                      return (
                        <button
                          key={di}
                          onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                          disabled={isFriSat && !dayEvents.length}
                          className={`relative flex flex-col items-center justify-center h-12 rounded-xl transition-colors
                            ${isSelected ? "bg-nct-navy/10 ring-2 ring-nct-navy" : "hover:bg-gray-50"}
                            ${isToday ? "ring-2 ring-nct-gold" : ""}
                            ${isFriSat ? "opacity-30" : ""}
                          `}
                        >
                          <span className={`text-sm font-medium ${isToday ? "text-nct-navy font-bold" : isClosed ? "text-red-400" : "text-gray-800"}`}>
                            {day}
                          </span>
                          <div className="flex gap-0.5 mt-0.5">
                            {hasBoutique && !isClosed && <span className="w-1.5 h-1.5 rounded-full bg-nct-navy" />}
                            {hasBins && !isClosed && <span className="w-1.5 h-1.5 rounded-full bg-nct-gold" />}
                            {isClosed && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected date detail */}
      {selectedDate && (
        <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-5">
          <p className="font-bold text-nct-navy mb-3">
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-gray-400">Closed (Friday or Saturday)</p>
          ) : (
            <ul className="space-y-2">
              {selectedEvents.map((ev, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${TYPE_STYLES[ev.type]?.dot || "bg-gray-400"}`} />
                  {ev.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-nct-navy inline-block" /> Boutique open</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-nct-gold inline-block" /> Bins / Sunday Sale</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Holiday closed</span>
      </div>
    </div>
  );
}
