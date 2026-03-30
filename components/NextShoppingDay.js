"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

export default function NextShoppingDay() {
  const [day, setDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");

  const fetchDay = useCallback(async () => {
    const res = await fetch("/api/reseller/shopping");
    if (res.ok) {
      const json = await res.json();
      setDay((json.days || [])[0] || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDay(); }, [fetchDay]);

  async function handleBook(slot_type) {
    if (!day) return;
    setActionLoading(true);
    setMessage("");
    const res = await fetch("/api/reseller/shopping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopping_day_id: day.id, slot_type }),
    });
    const json = await res.json();
    if (res.ok) {
      setMessage("✅ Booked! Check your email for confirmation.");
      fetchDay();
    } else {
      setMessage(json.error || "Failed to book.");
    }
    setActionLoading(false);
  }

  async function handleCancel(slot_type) {
    if (!day) return;
    setActionLoading(true);
    setMessage("");
    await fetch("/api/reseller/shopping", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopping_day_id: day.id, slot_type }),
    });
    setMessage("Booking cancelled.");
    fetchDay();
    setActionLoading(false);
  }

  if (loading) return <p className="text-gray-400 text-sm py-4">Loading…</p>;

  // No shopping days scheduled
  if (!day) {
    return (
      <div>
        <div className="bg-gray-50 rounded-xl p-6 text-center mb-4">
          <p className="text-2xl mb-2">📅</p>
          <p className="font-semibold text-gray-700">No shopping day scheduled yet</p>
          <p className="text-sm text-gray-500 mt-1">You'll get an email as soon as a route is scheduled.</p>
        </div>
        <div className="bg-nct-navy/5 border border-nct-navy/10 rounded-xl p-4 text-sm">
          <p className="font-semibold text-nct-navy mb-2">In the meantime</p>
          <ul className="space-y-1.5 text-gray-600">
            <li>🛍 <strong>Boutique</strong> — walk in Mon–Thu, 12PM–8PM. No booking needed.</li>
            <li>🗑️ <strong>Sunday Bin Sale</strong> — every Sunday 12PM–4PM, $2/lb, open to everyone.</li>
          </ul>
        </div>
      </div>
    );
  }

  const isSunday = day.is_sunday;
  const dateStr = new Date(day.shopping_date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const myWholesale = day.slots?.wholesale?.my_booking;
  const myBins = day.slots?.bins?.my_booking;
  const hasBooking = myWholesale || myBins;

  return (
    <div>
      {message && (
        <div className={`rounded-xl p-3 text-sm mb-4 ${message.startsWith("✅") ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
          {message}
        </div>
      )}

      {/* Next day header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Next Shopping Day</p>
          <p className="font-bold text-nct-navy text-lg">{dateStr}</p>
          {isSunday && <p className="text-xs text-nct-gold font-medium mt-0.5">Sunday Bin Sale — open to everyone · $2/lb</p>}
        </div>
        <Link href="/reseller/bookings" className="text-xs text-gray-400 hover:text-nct-navy underline">
          My bookings →
        </Link>
      </div>

      {/* Already booked banner */}
      {hasBooking && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
          <p className="font-semibold text-green-800 text-sm mb-2">✅ You're booked for {dateStr}</p>
          <div className="space-y-1.5">
            {myWholesale && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-700">Wholesale Sort — 10AM–4PM · $0.30/lb</span>
                <button onClick={() => handleCancel("wholesale")} disabled={actionLoading}
                  className="text-xs text-red-500 hover:underline disabled:opacity-50">Cancel</button>
              </div>
            )}
            {myBins && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-700">Bins — 12PM–4PM · $2/lb</span>
                <button onClick={() => handleCancel("bins")} disabled={actionLoading}
                  className="text-xs text-red-500 hover:underline disabled:opacity-50">Cancel</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Booking buttons */}
      {!isSunday && (
        <div className="space-y-3 mb-4">
          {/* Wholesale button */}
          {!myWholesale && (
            <button
              onClick={() => handleBook("wholesale")}
              disabled={actionLoading || day.slots.wholesale?.available === 0}
              className="w-full flex items-center justify-between bg-white border-2 border-nct-gold hover:bg-yellow-50 rounded-2xl p-5 transition-colors group disabled:opacity-50 disabled:cursor-default"
            >
              <div className="text-left">
                <p className="font-bold text-nct-navy text-lg">Sort Wholesale</p>
                <p className="text-sm text-gray-500">10AM–4PM · Unopened bags · $0.30/lb</p>
                <p className="text-xs text-gray-400 mt-1">Sort on-site. Keep what you pull.</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-nct-gold text-lg">$0.30/lb</p>
                {day.slots.wholesale?.available === 0
                  ? <p className="text-xs text-red-500 font-medium">Sold out</p>
                  : <p className="text-xs text-green-600 font-medium">{day.slots.wholesale?.available} spots left</p>
                }
              </div>
            </button>
          )}

          {/* Bins button */}
          {!myBins && (
            <button
              onClick={() => handleBook("bins")}
              disabled={actionLoading || day.slots.bins?.available === 0}
              className="w-full flex items-center justify-between bg-white border-2 border-blue-300 hover:bg-blue-50 rounded-2xl p-5 transition-colors group disabled:opacity-50 disabled:cursor-default"
            >
              <div className="text-left">
                <p className="font-bold text-nct-navy text-lg">Shop Bins</p>
                <p className="text-sm text-gray-500">12PM–4PM · Sorted bins · $2.00/lb</p>
                <p className="text-xs text-gray-400 mt-1">Restocked from morning wholesale sort.</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-blue-600 text-lg">$2.00/lb</p>
                {day.slots.bins?.available === 0
                  ? <p className="text-xs text-red-500 font-medium">Sold out</p>
                  : <p className="text-xs text-green-600 font-medium">{day.slots.bins?.available} spots left</p>
                }
              </div>
            </button>
          )}
        </div>
      )}

      {/* Sunday bins (open to all, no booking needed) */}
      {isSunday && !myBins && (
        <button
          onClick={() => handleBook("bins")}
          disabled={actionLoading}
          className="w-full flex items-center justify-between bg-white border-2 border-blue-300 hover:bg-blue-50 rounded-2xl p-5 transition-colors mb-4 disabled:opacity-50"
        >
          <div className="text-left">
            <p className="font-bold text-nct-navy text-lg">Shop Bins</p>
            <p className="text-sm text-gray-500">12PM–4PM · Open to everyone · $2.00/lb</p>
          </div>
          <p className="font-bold text-blue-600 text-lg">$2.00/lb</p>
        </button>
      )}

      {/* Boutique info */}
      <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
        🛍 <strong className="text-nct-navy">Boutique</strong> is always open Mon–Thu 12PM–8PM — no booking needed.
      </div>
    </div>
  );
}
