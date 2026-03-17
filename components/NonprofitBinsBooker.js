"use client";
import { useState, useEffect, useCallback } from "react";

export default function NonprofitBinsBooker() {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");

  const fetchDays = useCallback(async () => {
    const res = await fetch("/api/nonprofit/bins-booking");
    if (res.ok) {
      const json = await res.json();
      setDays(json.days || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDays(); }, [fetchDays]);

  async function handleBook(shopping_day_id) {
    setActionLoading(true);
    setMessage("");
    const res = await fetch("/api/nonprofit/bins-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopping_day_id }),
    });
    const json = await res.json();
    if (res.ok) {
      setMessage("✅ Booked! A confirmation email is on its way.");
      fetchDays();
    } else {
      setMessage(`Error: ${json.error}`);
    }
    setActionLoading(false);
  }

  async function handleCancel(shopping_day_id) {
    setActionLoading(true);
    setMessage("");
    await fetch("/api/nonprofit/bins-booking", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopping_day_id }),
    });
    setMessage("Booking cancelled.");
    fetchDays();
    setActionLoading(false);
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading upcoming shopping days…</p>;

  if (days.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-gray-400 text-sm">No shopping days scheduled yet.</p>
        <p className="text-gray-300 text-xs mt-1">Shopping days are created when NCT schedules a pickup route.</p>
      </div>
    );
  }

  return (
    <div>
      {message && (
        <div className={`rounded-lg p-3 text-sm mb-4 ${message.startsWith("Error") ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
          {message}
        </div>
      )}
      <div className="space-y-3">
        {days.map((day) => {
          const dateStr = new Date(day.shopping_date).toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric", year: "numeric",
          });
          const isFull = day.available === 0 && !day.my_booking;

          return (
            <div key={day.id} className={`border-2 rounded-xl p-4 ${day.my_booking ? "border-nct-gold bg-yellow-50" : isFull ? "border-gray-200 bg-gray-50 opacity-70" : "border-gray-200 bg-white"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-nct-navy">{dateStr}</p>
                  <p className="text-xs text-gray-500">12:00 PM – 4:00 PM · Bins Area · Up to 2 volunteers</p>
                  <div className="flex gap-1 mt-2">
                    {Array.from({ length: day.capacity }).map((_, i) => (
                      <div key={i} className={`h-2 w-6 rounded-full ${i < day.booked ? "bg-nct-navy" : "bg-gray-200"}`} />
                    ))}
                    <span className="text-xs text-gray-400 ml-2">{day.available} of {day.capacity} spots open</span>
                  </div>
                </div>
                <div className="shrink-0 ml-4">
                  {day.my_booking ? (
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-700 mb-1">✅ Booked</p>
                      <button
                        onClick={() => handleCancel(day.id)}
                        disabled={actionLoading}
                        className="text-xs text-red-500 underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleBook(day.id)}
                      disabled={actionLoading || isFull}
                      className="bg-nct-navy hover:bg-nct-navy-dark text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-40"
                    >
                      {isFull ? "Full" : actionLoading ? "Booking…" : "Book Visit"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
