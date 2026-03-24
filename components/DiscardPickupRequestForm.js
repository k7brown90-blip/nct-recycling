"use client";
import { useState, useEffect, useCallback } from "react";

const STATUS_COLORS = {
  pending:   "bg-yellow-100 text-yellow-800",
  scheduled: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function DiscardPickupRequestForm() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preferredDate, setPreferredDate] = useState("");
  const [estimatedBags, setEstimatedBags] = useState("");
  const [estimatedWeight, setEstimatedWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fetchRequests = useCallback(async () => {
    const res = await fetch("/api/discard/request-pickup");
    if (res.ok) {
      const json = await res.json();
      setRequests(json.requests || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const activeRequest = requests.find((r) => r.status === "pending" || r.status === "scheduled");

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true); setError(""); setMessage("");

    const res = await fetch("/api/discard/request-pickup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preferred_date: preferredDate || null,
        estimated_bags: estimatedBags ? parseInt(estimatedBags) : null,
        estimated_weight_lbs: estimatedWeight ? parseInt(estimatedWeight) : null,
        notes: notes || null,
      }),
    });

    if (res.ok) {
      setMessage("✅ Pickup request submitted. We'll be in touch to confirm a date.");
      setPreferredDate(""); setEstimatedBags(""); setEstimatedWeight(""); setNotes("");
      fetchRequests();
    } else {
      const json = await res.json();
      setError(json.error || "Failed to submit.");
    }
    setSubmitting(false);
  }

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>;

  return (
    <div>
      {activeRequest ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-semibold text-blue-800">You have an active pickup request.</p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[activeRequest.status]}`}>
              {activeRequest.status}
            </span>
            {activeRequest.scheduled_date && (
              <span className="text-sm text-blue-700">
                Scheduled: {new Date(activeRequest.scheduled_date + "T00:00:00").toLocaleDateString()}
              </span>
            )}
            {!activeRequest.scheduled_date && activeRequest.preferred_date && (
              <span className="text-sm text-blue-600">
                Preferred: {new Date(activeRequest.preferred_date + "T00:00:00").toLocaleDateString()}
              </span>
            )}
          </div>
          {activeRequest.estimated_bags && (
            <p className="text-xs text-blue-500 mt-1">~{activeRequest.estimated_bags} bags estimated</p>
          )}
          {activeRequest.admin_notes && (
            <p className="text-sm text-blue-700 mt-1 italic">NCT note: {activeRequest.admin_notes}</p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Preferred Date</label>
              <input type="date" value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Est. Bags</label>
              <input type="number" min="0" value={estimatedBags} onChange={(e) => setEstimatedBags(e.target.value)}
                placeholder="e.g. 20"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Est. Weight (lbs) — optional</label>
              <input type="number" min="0" value={estimatedWeight} onChange={(e) => setEstimatedWeight(e.target.value)}
                placeholder="Rough estimate is fine"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes — optional</label>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Access instructions, special items, etc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {message && <p className="text-green-600 text-sm">{message}</p>}
          <button type="submit" disabled={submitting}
            className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50">
            {submitting ? "Submitting…" : "Request Pickup →"}
          </button>
        </form>
      )}

      {requests.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Request History</p>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="flex items-start justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                    {r.scheduled_date && (
                      <span className="text-gray-600">{new Date(r.scheduled_date + "T00:00:00").toLocaleDateString()}</span>
                    )}
                    {!r.scheduled_date && r.preferred_date && (
                      <span className="text-gray-400">Preferred: {new Date(r.preferred_date + "T00:00:00").toLocaleDateString()}</span>
                    )}
                  </div>
                  {(r.estimated_bags || r.estimated_weight_lbs) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[r.estimated_bags && `~${r.estimated_bags} bags`, r.estimated_weight_lbs && `~${r.estimated_weight_lbs} lbs`].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {r.admin_notes && <p className="text-xs text-blue-600 mt-0.5">NCT: {r.admin_notes}</p>}
                </div>
                <span className="text-xs text-gray-400 shrink-0 ml-2">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
