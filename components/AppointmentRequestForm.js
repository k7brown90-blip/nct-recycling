"use client";
import { useState } from "react";

const CATEGORIES = [
  "Women's Clothing", "Men's Clothing", "Kids' Clothing",
  "Shoes", "Outerwear", "Bedding & Linens", "General Mixed", "Other",
];

export default function AppointmentRequestForm({ onSuccess }) {
  const [type, setType] = useState("in_person");
  const [preferredDate, setPreferredDate] = useState("");
  const [categories, setCategories] = useState([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function toggleCategory(cat) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const res = await fetch("/api/nonprofit/exchange-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointment_type: type,
        preferred_date: preferredDate || null,
        categories_requested: categories,
        notes,
      }),
    });

    if (res.ok) {
      setMessage("✅ Request submitted. NCT Recycling will confirm your appointment.");
      setPreferredDate("");
      setCategories([]);
      setNotes("");
      onSuccess?.();
    } else {
      const json = await res.json();
      setError(json.error || "Failed to submit request.");
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Appointment type */}
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            val: "in_person",
            label: "In-Person",
            desc: "Visit our warehouse to curate and select items yourself",
          },
          {
            val: "delivery",
            label: "Delivery",
            desc: "We curate a lot and deliver it — you cover labor & delivery cost",
          },
        ].map(({ val, label, desc }) => (
          <button
            key={val}
            type="button"
            onClick={() => setType(val)}
            className={`text-left border-2 rounded-lg p-3 transition-colors ${
              type === val
                ? "border-nct-gold bg-yellow-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <p className="font-semibold text-nct-navy text-sm">{label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
          </button>
        ))}
      </div>

      {/* Preferred date */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Preferred Date (optional)
        </label>
        <input
          type="date"
          value={preferredDate}
          onChange={(e) => setPreferredDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        {type === "in_person" && (
          <p className="text-xs text-gray-400 mt-1">In-person visits are Mondays by appointment.</p>
        )}
      </div>

      {/* Categories */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Categories Needed (check all that apply)
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => toggleCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                categories.includes(cat)
                  ? "bg-nct-navy text-white border-nct-navy"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Additional Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Any special requests or details for this appointment"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {message && <p className="text-green-600 text-sm">{message}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-nct-gold hover:bg-nct-gold-dark text-white font-bold py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? "Submitting…" : "Request Appointment"}
      </button>
    </form>
  );
}
