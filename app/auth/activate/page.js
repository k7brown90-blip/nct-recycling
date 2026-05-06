"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Image from "next/image";

function ActivateContent() {
  const params = useSearchParams();
  const tokenHash = params.get("token_hash");
  const tokenType = params.get("type");
  const next = params.get("next");
  const discardToken = params.get("discard_token");
  const [clicked, setClicked] = useState(false);
  const [error, setError] = useState("");
  const [agreementLoading, setAgreementLoading] = useState(Boolean(discardToken));
  const [agreementText, setAgreementText] = useState("");
  const [signerName, setSignerName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    if (!discardToken) return;

    let active = true;

    fetch(`/api/auth/discard-agreement?discard_token=${encodeURIComponent(discardToken)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!active) return;

        if (!res.ok) {
          setError(json.error || "Failed to load the discard agreement.");
          return;
        }

        setAgreementText(json.agreement_text || "");
        setSignerName(json.contact_name || "");
      })
      .catch(() => {
        if (active) {
          setError("Network error. Please reload or contact NCT Recycling.");
        }
      })
      .finally(() => {
        if (active) {
          setAgreementLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [discardToken]);

  // Detect link type from the verification type query param.
  const isRecovery = tokenType === "recovery";

  async function handleDiscardActivate() {
    if (!acceptedTerms) {
      setError("You must accept the discard agreement before continuing.");
      return;
    }
    if (!signerName.trim()) {
      setError("Enter the authorized representative name before continuing.");
      return;
    }

    setClicked(true);
    setError("");
    try {
      const res = await fetch("/api/auth/discard-activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discard_token: discardToken,
          signer_name: signerName.trim(),
          accepted_terms: acceptedTerms,
        }),
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
          Review and accept your discard purchase agreement below, then continue to set your password
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
        <div className="text-left border border-gray-200 rounded-xl bg-gray-50 p-4 mb-6">
          <p className="text-sm font-semibold text-nct-navy mb-2">Discard Purchase Agreement</p>
          {agreementLoading ? (
            <p className="text-sm text-gray-500">Loading agreement…</p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4">
              <pre className="whitespace-pre-wrap text-xs leading-5 text-gray-700 font-sans">{agreementText}</pre>
            </div>
          )}
        </div>
        <div className="text-left space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Authorized Representative Name</label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm"
              placeholder="Enter the signer name"
            />
          </div>
          <label className="flex items-start gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1"
            />
            <span>I have reviewed the discard purchase agreement above and I am authorized to accept it on behalf of the organization.</span>
          </label>
        </div>
        <button
          onClick={handleDiscardActivate}
          disabled={clicked || agreementLoading || !agreementText}
          className="bg-nct-gold hover:bg-nct-gold-dark disabled:opacity-60 text-white font-bold px-8 py-4 rounded-xl text-lg transition-colors w-full max-w-xs"
        >
          {clicked && !error ? "Opening…" : "Accept Agreement & Activate →"}
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

  // ── Standard invite/recovery flow: redeem the token via /auth/confirm ──
  if (!tokenHash || !tokenType) {
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
    const url = new URL("/auth/confirm", window.location.origin);
    url.searchParams.set("token_hash", tokenHash);
    url.searchParams.set("type", tokenType);
    if (next) url.searchParams.set("next", next);
    window.location.href = url.toString();
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
        <Link href="/" className="inline-flex items-center gap-3">
          <Image src="/images/nct-logo.png" alt="NCT Recycling" width={48} height={48} className="rounded" />
          <div className="text-left">
            <p className="text-nct-navy font-bold text-lg leading-none">NCT Recycling</p>
            <p className="text-nct-gold text-xs font-semibold uppercase tracking-widest">Fort Collins, CO</p>
          </div>
        </Link>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <Suspense fallback={<div className="text-center text-gray-400">Loading…</div>}>
          <ActivateContent />
        </Suspense>
      </div>
    </main>
  );
}
