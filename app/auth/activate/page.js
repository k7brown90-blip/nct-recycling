"use client";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Image from "next/image";

function ActivateContent() {
  const params = useSearchParams();
  const link = params.get("link");
  const [clicked, setClicked] = useState(false);

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
        <span className="text-3xl">✅</span>
      </div>
      <h1 className="text-2xl font-bold text-nct-navy mb-3">You&rsquo;re approved!</h1>
      <p className="text-gray-600 mb-8 leading-relaxed">
        Your NCT Recycling partner account is ready. Click the button below to
        set your password and access your portal.
      </p>
      <button
        onClick={handleActivate}
        disabled={clicked}
        className="bg-nct-gold hover:bg-nct-gold-dark disabled:opacity-60 text-white font-bold px-8 py-4 rounded-xl text-lg transition-colors w-full max-w-xs"
      >
        {clicked ? "Opening portal…" : "Activate My Account →"}
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
