"use client";
import { useState } from "react";
import Link from "next/link";

const STATUS_STYLES = {
  pending:  { bg: "bg-yellow-50",  border: "border-yellow-400", text: "text-yellow-800",  label: "Pending Review",  icon: "⏳" },
  approved: { bg: "bg-green-50",   border: "border-green-400",  text: "text-green-800",   label: "Approved",        icon: "✅" },
  denied:   { bg: "bg-red-50",     border: "border-red-400",    text: "text-red-800",     label: "Not Approved",    icon: "❌" },
};

export default function StatusPage() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLookup(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch(`/api/apply/status?email=${encodeURIComponent(email.trim())}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Lookup failed.");
      } else {
        setResult(json.application);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const s = result ? STATUS_STYLES[result.status] || STATUS_STYLES.pending : null;

  return (
    <main className="max-w-xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-nct-navy mb-2">Application Status</h1>
      <p className="text-gray-600 mb-8">Enter the email address you used to apply.</p>

      <form onSubmit={handleLookup} className="flex gap-3 mb-8">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-nct-navy text-white font-bold px-6 py-2 rounded-lg hover:bg-nct-navy-dark transition-colors disabled:opacity-50"
        >
          {loading ? "…" : "Look Up"}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4 text-red-700 text-sm mb-4">
          {error}
          {error.includes("No application") && (
            <p className="mt-2">
              <Link href="/apply" className="text-nct-navy underline">
                Submit a new application →
              </Link>
            </p>
          )}
        </div>
      )}

      {result && s && (
        <div className={`${s.bg} border-2 ${s.border} rounded-xl p-6`}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{s.icon}</span>
            <div>
              <p className="text-sm text-gray-600">Application Status</p>
              <p className={`text-xl font-bold ${s.text}`}>{s.label}</p>
            </div>
          </div>

          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-gray-500 w-36 shrink-0">Name:</dt>
              <dd className="font-medium">{result.full_name}</dd>
            </div>
            {result.business_name && (
              <div className="flex gap-2">
                <dt className="text-gray-500 w-36 shrink-0">Business:</dt>
                <dd className="font-medium">{result.business_name}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-gray-500 w-36 shrink-0">Access:</dt>
              <dd className="font-medium">{result.wants_warehouse_access ? "Online + warehouse" : "Online only"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-gray-500 w-36 shrink-0">Submitted:</dt>
              <dd>{new Date(result.created_at).toLocaleDateString()}</dd>
            </div>
            {result.reviewed_at && (
              <div className="flex gap-2">
                <dt className="text-gray-500 w-36 shrink-0">Reviewed:</dt>
                <dd>{new Date(result.reviewed_at).toLocaleDateString()}</dd>
              </div>
            )}
          </dl>

          {result.status === "pending" && (
            <p className="text-sm text-yellow-700 mt-4 pt-4 border-t border-yellow-300">
              We typically review applications within 2–3 business days. You'll receive an email
              at <strong>{email}</strong> when your status is updated.
            </p>
          )}

          {result.status === "approved" && (
            <div className="mt-4 pt-4 border-t border-green-300">
              <p className="text-sm text-green-700 font-medium">
                Your application has been approved! Please contact us to schedule your first visit.
              </p>
              <div className="flex gap-4 mt-3">
                <a href="tel:+19702329108" className="text-nct-navy underline text-sm">(970) 232-9108</a>
                <a href="mailto:donate@nctrecycling.com" className="text-nct-navy underline text-sm">
                  donate@nctrecycling.com
                </a>
              </div>
            </div>
          )}

          {result.status === "denied" && (
            <div className="mt-4 pt-4 border-t border-red-300">
              <p className="text-sm text-red-700">
                Unfortunately your application was not approved at this time. Please contact us
                for more information.
              </p>
              {result.admin_notes && (
                <p className="text-sm text-gray-700 mt-2">
                  <strong>Note:</strong> {result.admin_notes}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
