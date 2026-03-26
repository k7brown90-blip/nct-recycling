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
  const [estimatedBags, setEstimatedBags] = useState("");
  const [shipToAddress, setShipToAddress] = useState("");
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

    if (type === "delivery" && !shipToAddress.trim()) {
      setError("Please enter a shipping address for delivery.");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/nonprofit/exchange-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointment_type: type,
        preferred_date: preferredDate || null,
        categories_requested: categories,
        notes,
        estimated_bags: estimatedBags ? parseInt(estimatedBags) : null,
        ship_to_address: type === "delivery" ? shipToAddress.trim() : null,
      }),
    });

    if (res.ok) {
      setMessage(
        type === "delivery"
          ? "✅ Request submitted. NCT will review and send you a cost quote before confirming."
          : "✅ Request submitted. NCT Recycling will confirm your appointment."
      );
      setPreferredDate("");
      setCategories([]);
      setNotes("");
      setEstimatedBags("");
      setShipToAddress("");
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
            desc: "We curate a lot and ship it — you cover labor & FedEx cost",
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

      {/* Delivery-specific fields */}
      {type === "delivery" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <p className="text-xs text-amber-700 font-medium">
            NCT will review your request and send a cost quote covering labor (curation) + FedEx shipping.
            You confirm before we ship.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Estimated Bags Needed <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="number"
              min="1"
              value={estimatedBags}
              onChange={(e) => setEstimatedBags(e.target.value)}
              placeholder="e.g. 5"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Shipping Address <span className="text-red-500">*</span>
            </label>
            <textarea
              value={shipToAddress}
              onChange={(e) => setShipToAddress(e.target.value)}
              rows={2}
              placeholder="Street address, city, state, zip"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
        </div>
      )}

      {/* Preferred date */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Preferred Date <span className="text-gray-400">(optional)</span>
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
        {type === "delivery" && (
          <p className="text-xs text-gray-400 mt-1">Preferred ship date — actual date confirmed after quote approval.</p>
        )}
      </div>

      {/* Categories */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Categories Needed <span className="text-gray-400">(check all that apply)</span>
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
          Additional Notes <span className="text-gray-400">(optional)</span>
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
        {loading ? "Submitting…" : type === "delivery" ? "Request Delivery Quote" : "Request Appointment"}
      </button>
    </form>
  );
}
