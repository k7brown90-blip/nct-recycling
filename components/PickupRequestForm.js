"use client";
import { useState, useEffect, useCallback } from "react";

const STATUS_COLORS = {
  pending:   "bg-yellow-100 text-yellow-800",
  scheduled: "bg-blue-100 text-blue-800",
  cancelled: "bg-gray-100 text-gray-600",
};

const FILL_OPTIONS = [
  { value: "half",       label: "Half Full",   icon: "📦",  desc: "About half capacity" },
  { value: "full",       label: "Full",         icon: "📦📦", desc: "At capacity" },
  { value: "overflowing",label: "Overflowing",  icon: "🔴",  desc: "Over capacity — urgent" },
];

export default function PickupRequestForm({ onBack }) {
  const [pending, setPending] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cooldownWarning, setCooldownWarning] = useState(false);
  const [cooldownDays, setCooldownDays] = useState(0);
  const [consecutiveWarning, setConsecutiveWarning] = useState(false);
  const [capacity, setCapacity] = useState(40);

  const [fillLevel, setFillLevel] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/nonprofit/pickup-request");
    if (res.ok) {
      const json = await res.json();
      setPending(json.pending);
      setHistory(json.history || []);
      setCooldownWarning(json.cooldown_warning || false);
      setCooldownDays(json.cooldown_days || 0);
      setConsecutiveWarning(json.consecutive_no_inventory || false);
      setCapacity(json.capacity || 40);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!fillLevel) { setError("Select a fill level."); return; }
    setSubmitting(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/nonprofit/pickup-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fill_level: fillLevel, preferred_date: preferredDate || null, notes }),
    });
    if (res.ok) {
      setMessage("✅ Request submitted — NCT will be in touch to confirm your date.");
      setFillLevel(""); setPreferredDate(""); setNotes("");
      fetchData();
    } else {
      const json = await res.json();
      setError(json.error || "Failed to submit.");
    }
    setSubmitting(false);
  }

  async function handleCancel(id) {
    if (!confirm("Cancel this pickup request?")) return;
    await fetch("/api/nonprofit/pickup-request", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchData();
  }

  const estimateMap = { half: Math.round(capacity / 2), full: capacity, overflowing: Math.round(capacity * 1.5) };

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      {/* Consecutive no-inventory warning */}
      {consecutiveWarning && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800">
          ⚠️ Our driver found no inventory at your location on the last 2 visits. If inventory is ready now, please submit a request. Questions? Call (970) 232-9108.
        </div>
      )}

      {/* Active pending request */}
      {pending ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-semibold text-yellow-800 text-sm">Pickup Request Pending</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[pending.status]}`}>
              {pending.status}
            </span>
          </div>
          <div className="space-y-1 text-xs text-gray-600 mb-3">
            {pending.fill_level && (
              <p>Fill level: <span className="font-medium capitalize">{pending.fill_level}</span>
                {" "}(~{estimateMap[pending.fill_level] ?? pending.estimated_bags} bags)</p>
            )}
            {!pending.fill_level && pending.estimated_bags != null && (
              <p>Est. bags: <span className="font-medium">{pending.estimated_bags}</span></p>
            )}
            {pending.preferred_date && (
              <p>Preferred: <span className="font-medium">{new Date(pending.preferred_date + "T12:00:00").toLocaleDateString()}</span></p>
            )}
            {pending.notes && <p>Notes: {pending.notes}</p>}
            <p className="text-gray-400">Submitted {new Date(pending.created_at).toLocaleDateString()}</p>
          </div>
          <button onClick={() => handleCancel(pending.id)} className="text-xs text-red-600 hover:underline">
            Cancel request
          </button>
        </div>
      ) : (
        /* Submission form */
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cooldown warning */}
          {cooldownWarning && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
              ⚠️ You submitted a request {3 - cooldownDays > 0 ? `${3 - cooldownDays} day${3 - cooldownDays !== 1 ? "s" : ""} ago` : "recently"}. You can still submit — just a heads-up.
            </div>
          )}

          {/* Fill level selector */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">How full are your donation bags?</p>
            <div className="grid grid-cols-3 gap-2">
              {FILL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFillLevel(opt.value)}
                  className={`flex flex-col items-center p-3 rounded-xl border-2 transition-colors text-center
                    ${fillLevel === opt.value
                      ? "border-nct-navy bg-nct-navy/5 text-nct-navy"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                >
                  <span className="text-xl mb-1">{opt.icon}</span>
                  <span className="text-xs font-bold">{opt.label}</span>
                  <span className="text-xs text-gray-400 mt-0.5">~{estimateMap[opt.value]} bags</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Preferred pickup date <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Notes <span className="text-gray-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. mostly winter coats, best access is east loading dock"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {message && <p className="text-green-600 text-sm">{message}</p>}
          <button
            type="submit"
            disabled={submitting || !fillLevel}
            className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50 text-sm"
          >
            {submitting ? "Submitting…" : "Request Pickup"}
          </button>
        </form>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">Recent Requests</p>
          <div className="space-y-1">
            {history.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs text-gray-400">
                <span>
                  {new Date(r.created_at).toLocaleDateString()}
                  {r.fill_level ? ` · ${r.fill_level}` : ""}
                  {r.estimated_bags ? ` (~${r.estimated_bags} bags)` : ""}
                </span>
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${STATUS_COLORS[r.status]}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {onBack && (
        <button onClick={onBack} className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 underline">
          ← Back to Dashboard
        </button>
      )}
    </div>
  );
}
