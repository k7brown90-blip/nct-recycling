"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EmployeeAgreementsClient({
  employeeId,
  employeeName,
  pending,
  completed,
}) {
  const router = useRouter();
  const [activeTemplateId, setActiveTemplateId] = useState(pending[0]?.id || null);
  const [signedName, setSignedName] = useState(employeeName || "");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const activeTemplate = pending.find((p) => p.id === activeTemplateId) || null;

  async function handleSign(e) {
    e.preventDefault();
    setError("");
    if (!activeTemplate) return;
    if (!signedName.trim()) {
      setError("Type your full legal name to sign.");
      return;
    }
    if (!agreed) {
      setError("You must check the box to acknowledge.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/employee/acknowledgments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: activeTemplate.id,
          signed_name: signedName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save acknowledgment.");
      } else {
        router.refresh();
        setAgreed(false);
        setSignedName(employeeName || "");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-bold text-nct-navy mb-3">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-600 italic">
            No agreements awaiting your signature.
          </p>
        ) : (
          <div className="grid md:grid-cols-[280px_1fr] gap-4">
            <ul className="space-y-2">
              {pending.map((tpl) => (
                <li key={tpl.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTemplateId(tpl.id);
                      setError("");
                    }}
                    className={`w-full text-left px-3 py-2 rounded border ${
                      activeTemplateId === tpl.id
                        ? "border-nct-navy bg-nct-navy/5 font-semibold"
                        : "border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    <div className="text-sm">{tpl.title}</div>
                    <div className="text-xs text-gray-500">v{tpl.version_label}</div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="border border-gray-200 rounded-lg p-4 bg-white">
              {activeTemplate ? (
                <>
                  <h3 className="font-bold text-nct-navy mb-2">
                    {activeTemplate.title}
                  </h3>
                  <div className="text-xs text-gray-500 mb-3">
                    Version {activeTemplate.version_label}
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 max-h-96 overflow-y-auto bg-gray-50 border border-gray-200 rounded p-3 font-sans">
                    {activeTemplate.body_text}
                  </pre>
                  <form onSubmit={handleSign} className="mt-4 space-y-3 border-t pt-4">
                    <label className="block text-sm">
                      <span className="font-semibold text-gray-700">
                        Type your full legal name to sign
                      </span>
                      <input
                        type="text"
                        value={signedName}
                        onChange={(e) => setSignedName(e.target.value)}
                        className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        required
                      />
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        I have read and agree to <strong>{activeTemplate.title}</strong>{" "}
                        (v{activeTemplate.version_label}). My typed name above is my
                        electronic signature.
                      </span>
                    </label>
                    {error && (
                      <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                        {error}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="bg-nct-navy text-white font-bold px-5 py-2 rounded hover:bg-nct-navy-dark disabled:opacity-50"
                    >
                      {submitting ? "Saving…" : "Sign agreement"}
                    </button>
                  </form>
                </>
              ) : (
                <p className="text-sm text-gray-500">Select a document to review.</p>
              )}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold text-nct-navy mb-3">
          Signed ({completed.length})
        </h2>
        {completed.length === 0 ? (
          <p className="text-sm text-gray-600 italic">No signed agreements yet.</p>
        ) : (
          <ul className="divide-y border border-gray-200 rounded-lg bg-white">
            {completed.map((tpl) => (
              <li key={tpl.id} className="px-4 py-3 flex justify-between items-center">
                <div>
                  <div className="font-semibold text-sm text-nct-navy">{tpl.title}</div>
                  <div className="text-xs text-gray-500">
                    v{tpl.version_label} · signed as{" "}
                    <span className="font-medium">{tpl.acknowledgment.signed_name}</span> on{" "}
                    {new Date(tpl.acknowledgment.signed_at).toLocaleDateString()}
                  </div>
                </div>
                <span className="text-xs text-green-700 font-semibold">✓ Signed</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
