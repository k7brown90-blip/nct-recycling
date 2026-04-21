"use client";
import { useState } from "react";
import AgreementDownloadButton from "@/components/AgreementDownloadButton";
import { getProgramStatusPresentation } from "@/lib/organization-status";
import SignOutButton from "@/components/SignOutButton";
import DiscardPickupRequestForm from "@/components/DiscardPickupRequestForm";
import DiscardBagCountForm from "@/components/DiscardBagCountForm";

export default function DiscardDashboardClient({ account, program, user, pickups }) {
  const [section, setSection] = useState(null); // null | "pickup" | "payments" | "load"

  const firstName = account?.contact_name?.split(" ")[0] || "Partner";
  const pending = (pickups || []).filter((p) => p.payment_status === "pending");
  const outstanding = pending.reduce((s, p) => s + parseFloat(p.amount_owed || 0), 0);
  const status = getProgramStatusPresentation(program?.lifecycleStatus || account?.status || "active");
  const accountType = program?.accountType || account?.account_type;
  const orgName = program?.legalName || account?.org_name;
  const agreementSignedAt = program?.agreementSignedAt || account?.contract_date;

  function SectionHeader({ title }) {
    return (
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setSection(null)} className="text-nct-navy hover:text-nct-navy-dark font-bold text-lg leading-none">←</button>
        <h2 className="font-bold text-nct-navy text-xl">{title}</h2>
      </div>
    );
  }

  // ── Section: Request Pickup ──
  if (section === "pickup") {
    return (
      <div>
        <SectionHeader title="Request a Pickup" />
        <p className="text-sm text-gray-500 mb-4">
          Let us know when your load is ready. We'll confirm a pickup date with you.
        </p>
        <DiscardPickupRequestForm />
        <button onClick={() => setSection(null)} className="w-full text-sm text-gray-500 hover:text-gray-700 py-3 underline mt-4">
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  // ── Section: Track Load (LTL only) ──
  if (section === "load") {
    return (
      <div>
        <SectionHeader title="Track Your Load" />
        <p className="text-sm text-gray-500 mb-4">
          Log bags as they accumulate so NCT can see your load level and plan your pickup.
        </p>
        <DiscardBagCountForm />
        <button onClick={() => setSection(null)} className="w-full text-sm text-gray-500 hover:text-gray-700 py-3 underline mt-4">
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  // ── Section: Payment History ──
  if (section === "payments") {
    return (
      <div>
        <SectionHeader title="Payment History" />
        {outstanding > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-yellow-800">Outstanding balance: <span className="text-xl">${outstanding.toFixed(2)}</span></p>
            <p className="text-xs text-gray-500 mt-1">Pending payment from NCT</p>
          </div>
        )}
        {pickups && pickups.length > 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="divide-y divide-gray-100">
              {pickups.map((p) => (
                <div key={p.id} className="flex items-start justify-between p-4 text-sm">
                  <div>
                    <p className="font-medium">{new Date(p.pickup_date + "T00:00:00").toLocaleDateString()}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.weight_lbs ? `${parseFloat(p.weight_lbs).toLocaleString()} lbs` : "Weight TBD"}
                      {p.load_type && p.load_type !== "recurring" ? ` · ${p.load_type}` : ""}
                    </p>
                    {p.notes && <p className="text-xs text-gray-400 mt-0.5">{p.notes}</p>}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-semibold">${parseFloat(p.amount_owed || 0).toFixed(2)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                      p.payment_status === "paid" ? "bg-green-100 text-green-700" :
                      p.payment_status === "voided" ? "bg-gray-100 text-gray-500" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {p.payment_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-6 text-center text-sm text-gray-400">No pickups on record yet.</div>
        )}
        <button onClick={() => setSection(null)} className="w-full text-sm text-gray-500 hover:text-gray-700 py-3 underline mt-4">
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  // ── Main Dashboard ──
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-nct-navy">Welcome, {firstName}</h1>
          <p className="text-gray-500 text-sm mt-1">{orgName} · {user.email}</p>
        </div>
        <SignOutButton />
      </div>

      {/* Status row */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className={`${status.cardClass} border rounded-xl p-4`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${status.eyebrowClass}`}>Status</p>
          <p className={`text-lg font-bold ${status.textClass}`}>{status.label}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Account</p>
          <p className="text-sm font-bold text-nct-navy">{accountType === "fl" ? "Full Load" : "LTL"}</p>
        </div>
        <div className={`rounded-xl p-4 border ${outstanding > 0 ? "bg-yellow-50 border-yellow-300" : "bg-gray-50 border-gray-200"}`}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Balance Owed</p>
          <p className={`text-lg font-bold ${outstanding > 0 ? "text-yellow-700" : "text-gray-400"}`}>${outstanding.toFixed(2)}</p>
        </div>
      </div>

      {/* 3 Action buttons */}
      <div className="space-y-3 mb-8">
        <button
          onClick={() => setSection("pickup")}
          className="w-full flex items-center gap-4 bg-white border-2 border-nct-navy rounded-2xl p-5 hover:bg-nct-navy hover:text-white group transition-colors text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-nct-navy group-hover:bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-2xl">🚛</span>
          </div>
          <div>
            <p className="font-bold text-nct-navy group-hover:text-white text-lg">Request a Pickup</p>
            <p className="text-sm text-gray-500 group-hover:text-white/80">Let NCT know your load is ready.</p>
          </div>
          <span className="ml-auto text-gray-400 group-hover:text-white text-xl">›</span>
        </button>

        {accountType !== "fl" && (
          <button
            onClick={() => setSection("load")}
            className="w-full flex items-center gap-4 bg-white border-2 border-gray-200 rounded-2xl p-5 hover:border-nct-navy group transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-nct-navy/10 flex items-center justify-center shrink-0">
              <span className="text-2xl">📦</span>
            </div>
            <div>
              <p className="font-bold text-nct-navy text-lg">Track Your Load</p>
              <p className="text-sm text-gray-500">Log bag counts as your load accumulates.</p>
            </div>
            <span className="ml-auto text-gray-400 text-xl">›</span>
          </button>
        )}

        <button
          onClick={() => setSection("payments")}
          className="w-full flex items-center gap-4 bg-white border-2 border-gray-200 rounded-2xl p-5 hover:border-nct-navy group transition-colors text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-nct-navy/10 flex items-center justify-center shrink-0">
            <span className="text-2xl">💰</span>
          </div>
          <div>
            <p className="font-bold text-nct-navy text-lg">Payment History</p>
            <p className="text-sm text-gray-500">
              {outstanding > 0 ? `$${outstanding.toFixed(2)} pending from NCT` : "View your pickup and payment records."}
            </p>
          </div>
          <span className="ml-auto text-gray-400 text-xl">›</span>
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <h3 className="font-bold mb-3 text-nct-navy">Agreement on File</h3>
        <dl className="grid grid-cols-2 gap-3 text-sm mb-3">
          <div>
            <dt className="text-gray-500">Program</dt>
            <dd className="font-medium">Discard Purchase Agreement</dd>
          </div>
          <div>
            <dt className="text-gray-500">Contract Date</dt>
            <dd className="font-medium">
              {agreementSignedAt ? new Date(agreementSignedAt).toLocaleDateString() : "—"}
            </dd>
          </div>
        </dl>
        <AgreementDownloadButton endpoint="/api/discard/agreement" />
      </div>

      {/* Contact */}
      <div className="bg-nct-navy text-white rounded-xl p-5">
        <h3 className="font-bold mb-2">Questions?</h3>
        <div className="flex gap-4 text-sm">
          <a href="tel:+19702329108" className="text-nct-gold underline">(970) 232-9108</a>
          <a href="mailto:donate@nctrecycling.com" className="text-nct-gold underline">donate@nctrecycling.com</a>
        </div>
      </div>
    </div>
  );
}
