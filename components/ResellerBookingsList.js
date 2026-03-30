"use client";
import { useState, useEffect, useCallback } from "react";

const SLOT_LABELS = {
  wholesale: "Wholesale Sort — $0.30/lb",
  bins: "Bins — $2.00/lb",
};

export default function ResellerBookingsList() {
  const [upcoming, setUpcoming] = useState([]);
  const [past, setPast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);
  const [message, setMessage] = useState("");

  const fetchBookings = useCallback(async () => {
    const res = await fetch("/api/reseller/bookings");
    if (res.ok) {
      const json = await res.json();
      setUpcoming(json.upcoming || []);
      setPast(json.past || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  async function handleCancel(booking_id) {
    if (!confirm("Cancel this booking?")) return;
    setCancelling(booking_id);
    const res = await fetch("/api/reseller/bookings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id }),
    });
    if (res.ok) {
      setMessage("Booking cancelled.");
      fetchBookings();
    } else {
      setMessage("Failed to cancel.");
    }
    setCancelling(null);
  }

  if (loading) return <p className="text-gray-400 text-sm py-4">Loading…</p>;

  return (
    <div className="space-y-6">
      {message && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm text-gray-600">{message}</div>
      )}

      {/* Upcoming */}
      <div>
        <h2 className="font-bold text-nct-navy mb-3">Upcoming Bookings</h2>
        {upcoming.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-5 text-center text-sm text-gray-400">
            No upcoming bookings.
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => {
              const dateStr = new Date(b.shopping_days?.shopping_date + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long", month: "long", day: "numeric",
              });
              return (
                <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-nct-navy text-sm">{dateStr}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{SLOT_LABELS[b.slot_type] || b.slot_type}</p>
                  </div>
                  <button
                    onClick={() => handleCancel(b.id)}
                    disabled={cancelling === b.id}
                    className="text-xs text-red-500 hover:underline disabled:opacity-50"
                  >
                    {cancelling === b.id ? "Cancelling…" : "Cancel"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h2 className="font-bold text-nct-navy mb-3">Past Bookings</h2>
          <div className="space-y-2">
            {past.map((b) => {
              const dateStr = new Date(b.shopping_days?.shopping_date + "T12:00:00").toLocaleDateString("en-US", {
                month: "long", day: "numeric", year: "numeric",
              });
              return (
                <div key={b.id} className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-700 font-medium">{dateStr}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{SLOT_LABELS[b.slot_type] || b.slot_type}</p>
                  </div>
                  <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">Past</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
