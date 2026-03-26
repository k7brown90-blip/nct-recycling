"use client";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Image from "next/image";

function ActivateContent() {
  const params = useSearchParams();
  const link = params.get("link");
  const discardToken = params.get("discard_token");
  const [clicked, setClicked] = useState(false);
  const [error, setError] = useState("");

  // Detect link type from the encoded Supabase URL (legacy co-op/reseller flow)
  const isRecovery = link?.includes("type=recovery");

  async function handleDiscardActivate() {
    setClicked(true);
    setError("");
    try {
      const res = await fetch("/api/auth/discard-activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discard_token: discardToken }),
      });
      const json = await res.json();
      if (!res.ok || !json.link) {
        setError(json.error || "Something went wrong. Please contact NCT Recycling.");
        setClicked(false);
        return;
      }
      window.location.href = json.link;
    } catch {
      setError("Network error. Please try again.");
      setClicked(false);
    }
  }

  // ── Discard partner: on-demand link generation ──────────────────────────
  // The Supabase auth link is NOT in the URL. It's generated fresh when the
  // user clicks the button so email scanners can't consume it first.
  if (discardToken) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">✅</span>
        </div>
        <h1 className="text-2xl font-bold text-nct-navy mb-3">You&apos;re approved!</h1>
        <p className="text-gray-600 mb-8 leading-relaxed">
          Your NCT Recycling partner account is ready. Click the button below to set your password
          and access your portal.
        </p>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-red-700 text-sm">{error}</p>
            <p className="text-red-500 text-xs mt-1">
              Contact us at{" "}
              <a href="mailto:donate@nctrecycling.com" className="underline">donate@nctrecycling.com</a>
              {" "}or (970) 232-9108.
            </p>
          </div>
        )}
        <button
          onClick={handleDiscardActivate}
          disabled={clicked}
          className="bg-nct-gold hover:bg-nct-gold-dark disabled:opacity-60 text-white font-bold px-8 py-4 rounded-xl text-lg transition-colors w-full max-w-xs"
        >
          {clicked && !error ? "Opening…" : "Activate My Account →"}
        </button>
        <p className="text-xs text-gray-400 mt-6">
          Questions?{" "}
          <a href="mailto:donate@nctrecycling.com" className="underline">
            donate@nctrecycling.com
          </a>{" "}
          · (970) 232-9108
        </p>
      </div>
    );
  }

  // ── Legacy flow: Supabase link is in the URL (co-op / reseller invites) ──
  if (!link) {
    return (
      <div className="text-center">
        <p className="text-red-600 font-semibold mb-4">Invalid activation link.</p>
        <p className="text-gray-600 text-sm">
          Please contact us at{" "}
          <a href="mailto:donate@nctrecycling.com" className="text-nct-navy underline">
            donate@nctrecycling.com
          </a>{" "}
          or call{" "}
          <a href="tel:+19702329108" className="text-nct-navy underline">
            (970) 232-9108
          </a>
          .
        </p>
      </div>
    );
  }

  function handleActivate() {
    setClicked(true);
    window.location.href = link;
  }

  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-3xl">{isRecovery ? "🔑" : "✅"}</span>
      </div>
      <h1 className="text-2xl font-bold text-nct-navy mb-3">
        {isRecovery ? "Reset your password" : "You\u2019re approved!"}
      </h1>
      <p className="text-gray-600 mb-8 leading-relaxed">
        {isRecovery
          ? "Click the button below to set a new password for your NCT Recycling account."
          : "Your NCT Recycling partner account is ready. Click the button below to set your password and access your portal."}
      </p>
      <button
        onClick={handleActivate}
        disabled={clicked}
        className="bg-nct-gold hover:bg-nct-gold-dark disabled:opacity-60 text-white font-bold px-8 py-4 rounded-xl text-lg transition-colors w-full max-w-xs"
      >
        {clicked ? "Opening…" : isRecovery ? "Reset My Password →" : "Activate My Account →"}
      </button>
      <p className="text-xs text-gray-400 mt-6">
        This link is single-use and expires in 24 hours.
        <br />
        Questions?{" "}
        <a href="mailto:donate@nctrecycling.com" className="underline">
          donate@nctrecycling.com
        </a>{" "}
        · (970) 232-9108
      </p>
    </div>
  );
}

export default function ActivatePage() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-16">
      <div className="mb-8 text-center">
        <a href="/" className="inline-flex items-center gap-3">
          <Image src="/images/nct-logo.png" alt="NCT Recycling" width={48} height={48} className="rounded" />
          <div className="text-left">
            <p className="text-nct-navy font-bold text-lg leading-none">NCT Recycling</p>
            <p className="text-nct-gold text-xs font-semibold uppercase tracking-widest">Fort Collins, CO</p>
          </div>
        </a>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <Suspense fallback={<div className="text-center text-gray-400">Loading…</div>}>
          <ActivateContent />
        </Suspense>
      </div>
    </main>
  );
}
