"use client";
import { useState } from "react";

export default function AgreementDownloadButton({ endpoint = "/api/nonprofit/agreement", label = "Download Signed Agreement (PDF) →" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(endpoint);
      const json = await res.json();
      if (!res.ok || !json.url) {
        setError(json.error || "Agreement not available yet.");
        return;
      }
      window.open(json.url, "_blank");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        onClick={handleDownload}
        disabled={loading}
        className="text-sm font-medium text-nct-navy underline hover:text-nct-gold transition-colors disabled:opacity-50"
      >
        {loading ? "Generating link…" : label}
      </button>
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}
