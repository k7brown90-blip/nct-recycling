"use client";
import { useState, useEffect, useCallback } from "react";

const SLOT_DISPLAY = {
  wholesale: {
    label: "Wholesale",
    hours: "10:00 AM – 4:00 PM",
    price: "$0.30 / lb",
    desc: "Unopened bags — sort on-site and take what you pull.",
    color: "border-nct-gold bg-yellow-50",
    badgeColor: "bg-yellow-100 text-yellow-800",
  },
  bins: {
    label: "Bins",
    hours: "12:00 PM – 4:00 PM",
    price: "$2.00 / lb",
    desc: "Sorted bins restocked from the morning wholesale sort.",
    color: "border-blue-300 bg-blue-50",
    badgeColor: "bg-blue-100 text-blue-800",
  },
};

function SlotCard({ type, slot, dayId, onBook, onCancel, loading }) {
  const display = SLOT_DISPLAY[type];
  const isFull = slot.available === 0 && !slot.my_booking && !slot.no_cap;
  const spotsLeft = slot.available;

  function availabilityLabel() {
    if (slot.no_cap) return "Open — no cap";
    if (isFull && !slot.my_booking) return "Full";
    return `${spotsLeft} / ${slot.capacity} open`;
  }

  return (
    <div className={`border-2 rounded-xl p-4 ${slot.my_booking ? display.color : isFull ? "border-gray-200 bg-gray-50 opacity-70" : "border-gray-200 bg-white"}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-bold text-nct-navy">{display.label}</p>
          <p className="text-sm text-gray-500">{display.hours}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-nct-navy">{display.price}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full ${display.badgeColor}`}>
            {availabilityLabel()}
          </span>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-3">{display.desc}</p>

      {/* Availability bar — skip for no-cap Sunday bins */}
      {!slot.no_cap && (
        <div className="flex gap-1 mb-3">
          {Array.from({ length: slot.capacity }).map((_, i) => (
            <div key={i} className={`h-2 flex-1 rounded-full ${i < slot.booked ? "bg-nct-navy" : "bg-gray-200"}`} />
          ))}
        </div>
      )}
      {slot.no_cap && <div className="mb-3" />}

      {slot.my_booking ? (
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-green-700">✅ You're booked</span>
          <button
            onClick={() => onCancel(dayId, type)}
            disabled={loading}
            className="text-xs text-red-500 underline disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => onBook(dayId, type)}
          disabled={loading || isFull}
          className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold py-2 rounded-lg text-sm transition-colors disabled:opacity-40"
        >
          {isFull ? "Sold Out" : loading ? "Booking…" : `Book ${display.label} Slot`}
        </button>
      )}
    </div>
  );
}

export default function ShoppingDayBooker() {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");

  const fetchDays = useCallback(async () => {
    const res = await fetch("/api/reseller/shopping");
    if (res.ok) {
      const json = await res.json();
      setDays(json.days || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDays(); }, [fetchDays]);

  async function handleBook(shopping_day_id, slot_type) {
    setActionLoading(true);
    setMessage("");
    const res = await fetch("/api/reseller/shopping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopping_day_id, slot_type }),
    });
    const json = await res.json();
    if (res.ok) {
      setMessage(`✅ Booked! A confirmation email is on its way.`);
      fetchDays();
    } else {
      setMessage(`Error: ${json.error}`);
    }
    setActionLoading(false);
  }

  async function handleCancel(shopping_day_id, slot_type) {
    setActionLoading(true);
    setMessage("");
    await fetch("/api/reseller/shopping", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopping_day_id, slot_type }),
    });
    setMessage("Booking cancelled.");
    fetchDays();
    setActionLoading(false);
  }

  if (loading) return <p className="text-gray-400 text-sm">Loading upcoming shopping days…</p>;

  if (days.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-gray-400 text-sm">No shopping days scheduled yet.</p>
        <p className="text-gray-300 text-xs mt-1">You'll get an email as soon as a pickup route is scheduled.</p>
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
      <div className="space-y-6">
        {days.map((day) => {
          const dateStr = new Date(day.shopping_date).toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric", year: "numeric",
          });
          return (
            <div key={day.id}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-nct-navy">{dateStr}</h3>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full capitalize">{day.status}</span>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <SlotCard type="wholesale" slot={day.slots.wholesale} dayId={day.id} onBook={handleBook} onCancel={handleCancel} loading={actionLoading} />
                <SlotCard type="bins" slot={day.slots.bins} dayId={day.id} onBook={handleBook} onCancel={handleCancel} loading={actionLoading} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Boutique callout */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
        <p className="font-semibold text-nct-navy mb-1">🛍 Boutique — No Booking Required</p>
        <p>The boutique is open Mon–Thu, 10:00 AM – 4:00 PM. Walk in any time — it's always stocked.</p>
      </div>
    </div>
  );
}
