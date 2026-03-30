"use client";
import { useState, useEffect, useCallback } from "react";

export default function PickupRequestForm() {
  const [pending, setPending] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [estimatedBags, setEstimatedBags] = useState("");
  const [estimatedWeight, setEstimatedWeight] = useState("");
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
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!estimatedBags && !estimatedWeight) {
      setError("Enter at least an estimated bag count or weight.");
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/nonprofit/pickup-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estimated_bags: estimatedBags ? parseInt(estimatedBags) : null,
        estimated_weight_lbs: estimatedWeight ? parseFloat(estimatedWeight) : null,
        preferred_date: preferredDate || null,
        notes,
      }),
    });
    if (res.ok) {
      setMessage("✅ Pickup request submitted. NCT will be in touch to confirm your date.");
      setEstimatedBags(""); setEstimatedWeight(""); setPreferredDate(""); setNotes("");
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

  const STATUS_COLORS = {
    pending:   "bg-yellow-100 text-yellow-800",
    scheduled: "bg-blue-100 text-blue-800",
    cancelled: "bg-gray-100 text-gray-600",
  };

  if (loading) return null;

  return (
    <div>
      {/* Pending request display */}
      {pending ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm font-semibold text-yellow-800">Pickup Request Pending</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[pending.status]}`}>
                  {pending.status}
                </span>
              </div>
              <div className="space-y-1 text-xs text-gray-600 mb-3">
                {pending.estimated_bags != null && (
                  <p>Est. bags: <span className="font-medium">{pending.estimated_bags}</span></p>
                )}
                {pending.estimated_weight_lbs != null && (
                  <p>Est. weight: <span className="font-medium">{pending.estimated_weight_lbs} lbs</span></p>
                )}
                {pending.preferred_date && (
                  <p>Preferred date: <span className="font-medium">{new Date(pending.preferred_date + "T12:00:00").toLocaleDateString()}</span></p>
                )}
                {pending.notes && <p>Notes: {pending.notes}</p>}
                <p className="text-gray-400">Submitted: {new Date(pending.created_at).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => handleCancel(pending.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Cancel this request
              </button>
            </div>
          ) : (
            /* Submission form */
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-xs text-gray-500">
                Tell us roughly what you have and we'll schedule a pickup. Our driver will confirm the count on arrival.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Est. Bags <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="number" min="1"
                    value={estimatedBags}
                    onChange={(e) => setEstimatedBags(e.target.value)}
                    placeholder="e.g. 10"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Est. Weight (lbs) <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="number" min="1"
                    value={estimatedWeight}
                    onChange={(e) => setEstimatedWeight(e.target.value)}
                    placeholder="e.g. 200"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
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
                disabled={submitting}
                className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold py-2 rounded-lg transition-colors disabled:opacity-50 text-sm"
              >
                {submitting ? "Submitting…" : "Submit Pickup Request"}
              </button>
            </form>
          )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">Recent Requests</p>
          <div className="space-y-1">
            {history.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-xs text-gray-400">
                <span>
                  {new Date(r.created_at).toLocaleDateString()}
                  {r.estimated_bags ? ` · ${r.estimated_bags} bags` : ""}
                  {r.estimated_weight_lbs ? ` · ${r.estimated_weight_lbs} lbs` : ""}
                </span>
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${STATUS_COLORS[r.status]}`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
