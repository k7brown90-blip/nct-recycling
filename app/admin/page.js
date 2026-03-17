"use client";
import { useState, useEffect, useCallback } from "react";

const STATUS_COLORS = {
  pending:  "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  denied:   "bg-red-100 text-red-800",
};

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");

  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/applications?status=${filter}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (res.status === 401) { setAuthed(false); return; }
    const json = await res.json();
    setApplications(json.applications || []);
    setLoading(false);
  }, [filter, secret]);

  useEffect(() => {
    if (authed) fetchApplications();
  }, [authed, fetchApplications]);

  async function handleAuth(e) {
    e.preventDefault();
    const res = await fetch("/api/admin/applications", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (res.ok) {
      setAuthed(true);
      setAuthError("");
    } else {
      setAuthError("Invalid password.");
    }
  }

  async function handleAction(status) {
    if (!selected) return;
    setActionLoading(true);
    setMessage("");
    const res = await fetch("/api/admin/applications", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ id: selected.id, status, admin_notes: notes }),
    });
    if (res.ok) {
      setMessage(`Application ${status}.`);
      setSelected(null);
      setNotes("");
      fetchApplications();
    } else {
      setMessage("Action failed. Try again.");
    }
    setActionLoading(false);
  }

  async function viewDR0563(fileName) {
    const res = await fetch(`/api/admin/dr0563?file=${encodeURIComponent(fileName)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const json = await res.json();
    if (json.url) window.open(json.url, "_blank");
  }

  if (!authed) {
    return (
      <main className="max-w-sm mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-nct-navy mb-6">Admin Login</h1>
        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Admin password"
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
          />
          {authError && <p className="text-red-600 text-sm">{authError}</p>}
          <button
            type="submit"
            className="w-full bg-nct-navy text-white font-bold py-2 rounded-lg hover:bg-nct-navy-dark transition-colors"
          >
            Sign In
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-nct-navy">Partner Applications</h1>
        <button
          onClick={() => setAuthed(false)}
          className="text-sm text-gray-500 underline"
        >
          Sign out
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {["pending", "approved", "denied", ""].map((s) => (
          <button
            key={s}
            onClick={() => { setFilter(s); setSelected(null); }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === s
                ? "bg-nct-navy text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <button
          onClick={fetchApplications}
          className="ml-auto px-4 py-2 rounded-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-700"
        >
          ↻ Refresh
        </button>
      </div>

      {message && (
        <div className="bg-green-50 border border-green-300 rounded-lg p-3 text-green-700 text-sm mb-4">
          {message}
        </div>
      )}

      <div className="flex gap-6">
        {/* List */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <p className="text-gray-500 text-sm">Loading…</p>
          ) : applications.length === 0 ? (
            <p className="text-gray-500 text-sm">No applications found.</p>
          ) : (
            <div className="space-y-2">
              {applications.map((app) => (
                <button
                  key={app.id}
                  onClick={() => { setSelected(app); setNotes(app.admin_notes || ""); }}
                  className={`w-full text-left border rounded-lg px-4 py-3 transition-colors hover:border-nct-navy ${
                    selected?.id === app.id ? "border-nct-navy bg-blue-50" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{app.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {app.email} · {app.business_name || "—"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[app.status]}`}>
                        {app.status}
                      </span>
                      <span className="text-xs text-gray-400 capitalize">{app.program_type}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(app.created_at).toLocaleDateString()}
                    {app.dr0563_file_url && " · DR 0563 on file"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="w-96 shrink-0 border border-gray-200 rounded-xl p-5 self-start sticky top-20">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-bold text-nct-navy text-lg">{selected.full_name}</h2>
                <p className="text-sm text-gray-500">{selected.email}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <dl className="space-y-1.5 text-sm mb-4">
              {[
                ["Business", selected.business_name],
                ["Phone", selected.phone],
                ["Program", selected.program_type],
                ["Platforms", selected.platforms?.join(", ")],
                ["Website", selected.website],
                ["Visit Freq", selected.visit_frequency],
                ["Expected Spend", selected.expected_spend],
                ["Categories", selected.categories?.join(", ")],
                ["Tax License #", selected.tax_license_number],
                ["Monthly Volume", selected.estimated_monthly_volume],
                ["Business Type", selected.business_type],
                ["Feature Consent", selected.feature_consent ? "Yes" : "No"],
                ["Shop to Feature", selected.shop_name_to_feature],
                ["Signed As", selected.contract_signed_name],
                ["Agreed At", selected.contract_agreed_at ? new Date(selected.contract_agreed_at).toLocaleString() : null],
                ["Submitted", new Date(selected.created_at).toLocaleString()],
              ].filter(([, v]) => v).map(([label, val]) => (
                <div key={label} className="flex gap-2">
                  <dt className="text-gray-500 w-32 shrink-0">{label}:</dt>
                  <dd className="font-medium break-all">{val}</dd>
                </div>
              ))}
            </dl>

            {selected.dr0563_file_url && (
              <button
                onClick={() => viewDR0563(selected.dr0563_file_url)}
                className="text-nct-navy underline text-sm mb-4 block"
              >
                View DR 0563 →
              </button>
            )}

            <div className="border-t border-gray-200 pt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Admin Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional note (visible to applicant if denied)"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleAction("approved")}
                  disabled={actionLoading || selected.status === "approved"}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-2 rounded transition-colors disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleAction("denied")}
                  disabled={actionLoading || selected.status === "denied"}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2 rounded transition-colors disabled:opacity-40"
                >
                  Deny
                </button>
                <button
                  onClick={() => handleAction("pending")}
                  disabled={actionLoading || selected.status === "pending"}
                  className="px-3 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-bold py-2 rounded transition-colors disabled:opacity-40"
                  title="Reset to pending"
                >
                  ↺
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
