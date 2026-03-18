"use client";
import { useState, useEffect } from "react";

const STATUS_COLORS = {
  pending:   "bg-yellow-100 text-yellow-800",
  reviewed:  "bg-blue-100 text-blue-800",
  scheduled: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-600",
};

export default function ContainerRequestSection() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function fetchRequests() {
    setLoading(true);
    const res = await fetch("/api/nonprofit/container-request");
    const json = await res.json();
    setRequests(json.requests || []);
    setLoading(false);
  }

  useEffect(() => { fetchRequests(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    const formData = new FormData();
    if (notes) formData.append("notes", notes);
    if (photo) formData.append("photo", photo);

    const res = await fetch("/api/nonprofit/container-request", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      setMessage("✅ Pickup request submitted. NCT will be in touch to confirm.");
      setNotes("");
      setPhoto(null);
      setShowForm(false);
      fetchRequests();
    } else {
      const json = await res.json();
      setMessage(`Error: ${json.error}`);
    }
    setSubmitting(false);
  }

  const hasPending = requests.some((r) => r.status === "pending" || r.status === "reviewed" || r.status === "scheduled");

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold text-nct-navy text-lg">Container Pickup Requests</h2>
        {!hasPending && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-nct-navy hover:bg-nct-navy-dark text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
          >
            {showForm ? "Cancel" : "Request Pickup"}
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">
        When your container is approximately 75% full, submit a pickup request with a photo so we can
        confirm and schedule collection.
      </p>

      {message && (
        <div className={`rounded-lg p-3 text-sm mb-4 ${message.startsWith("Error") ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
          {message}
        </div>
      )}

      {hasPending && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 mb-4">
          You have an open pickup request. NCT will contact you to confirm a date.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="border border-gray-200 rounded-xl p-4 mb-4 space-y-4 bg-gray-50">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Container Photo <span className="text-gray-400 font-normal">(recommended — shows fill level)</span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-nct-navy file:text-white file:text-sm file:font-medium hover:file:bg-nct-navy-dark"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Container is about 80% full, accessible from the east gate"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-nct-navy hover:bg-nct-navy-dark text-white font-bold py-2.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit Pickup Request →"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No pickup requests yet.</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="flex items-start justify-between border border-gray-100 rounded-lg px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="text-gray-500 text-xs">{new Date(r.created_at).toLocaleDateString()}</p>
                {r.notes && <p className="text-gray-700 mt-0.5">{r.notes}</p>}
                {r.scheduled_date && (
                  <p className="text-blue-700 font-medium mt-0.5">
                    Scheduled: {new Date(r.scheduled_date + "T00:00:00").toLocaleDateString()}
                  </p>
                )}
                {r.admin_notes && (
                  <p className="text-gray-500 mt-0.5 text-xs">NCT: {r.admin_notes}</p>
                )}
                {r.container_photo_path && (
                  <p className="text-xs text-gray-400 mt-0.5">📷 Photo attached</p>
                )}
              </div>
              <span className={`ml-3 shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || "bg-gray-100 text-gray-600"}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
