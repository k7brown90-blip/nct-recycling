"use client";
import { useState } from "react";

export default function BagCountForm({ currentCount, onSuccess }) {
  const [count, setCount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const num = parseInt(count, 10);
    if (isNaN(num) || num < 0) { setError("Enter a valid number."); return; }
    setLoading(true);
    setError("");
    setMessage("");

    const res = await fetch("/api/nonprofit/bag-count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bag_count: num, notes }),
    });

    if (res.ok) {
      setMessage(`✅ Bag count updated to ${num}.`);
      setCount("");
      setNotes("");
      onSuccess?.(num);
    } else {
      const json = await res.json();
      setError(json.error || "Failed to update.");
    }
    setLoading(false);
  }

  return (
    <div>
      {currentCount !== null && (
        <div className="flex items-center gap-3 mb-4">
          <span className="text-4xl font-bold text-nct-navy">{currentCount}</span>
          <span className="text-gray-500 text-sm">bags currently on record</span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Current bag count
            </label>
            <input
              type="number"
              min="0"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="e.g. 12"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-medium"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-nct-navy hover:bg-nct-navy-dark text-white font-bold px-5 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? "Saving…" : "Update Count"}
          </button>
        </div>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional note (e.g. includes winter coats)"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {message && <p className="text-green-600 text-sm">{message}</p>}
      </form>
    </div>
  );
}
