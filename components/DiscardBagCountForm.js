"use client";
import { useState, useEffect, useCallback } from "react";

export default function DiscardBagCountForm() {
  const [total, setTotal] = useState(null);
  const [history, setHistory] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [count, setCount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    const res = await fetch("/api/discard/bag-count");
    if (res.ok) {
      const json = await res.json();
      setTotal(json.total ?? 0);
      setHistory(json.sinceLastPickup || []);
    }
    setDataLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSubmit(e) {
    e.preventDefault();
    const num = parseInt(count, 10);
    if (isNaN(num) || num < 1) { setError("Enter at least 1 bag."); return; }
    setLoading(true); setError(""); setMessage("");

    const res = await fetch("/api/discard/bag-count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bag_count: num, notes }),
    });

    if (res.ok) {
      setMessage(`✅ Added ${num} bag${num !== 1 ? "s" : ""}.`);
      setCount(""); setNotes(""); fetchData();
    } else {
      const json = await res.json();
      setError(json.error || "Failed to save.");
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="flex items-end gap-3 mb-5">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Current Total</p>
          {dataLoading ? (
            <p className="text-4xl font-bold text-gray-300">—</p>
          ) : (
            <p className="text-4xl font-bold text-nct-navy">{total ?? 0}</p>
          )}
        </div>
        <p className="text-gray-500 text-sm pb-1">bags since last pickup</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Bags to add</label>
            <input
              type="number" min="1" value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="e.g. 5"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg font-medium"
            />
          </div>
          <button type="submit" disabled={loading}
            className="bg-nct-navy hover:bg-nct-navy-dark text-white font-bold px-5 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap">
            {loading ? "Saving…" : "+ Add Bags"}
          </button>
        </div>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional note (e.g. winter coats, sorted by type)"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600" />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {message && <p className="text-green-600 text-sm">{message}</p>}
      </form>

      {history.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">Entries since last pickup</p>
          <div className="space-y-1">
            {history.map((entry, i) => (
              <div key={entry.id || i} className="flex justify-between text-xs text-gray-400">
                <span>
                  {new Date(entry.created_at).toLocaleDateString()} — +{entry.bag_count} bags
                  {entry.notes ? ` (${entry.notes})` : ""}
                </span>
                <span className="font-medium text-gray-500">
                  {history.slice(i).reduce((s, e) => s + (e.bag_count || 0), 0)} total
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
