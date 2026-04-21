"use client";
import { useState } from "react";
import { getProgramStatusPresentation } from "@/lib/organization-status";
import SignOutButton from "@/components/SignOutButton";
import BagCountForm from "@/components/BagCountForm";
import PickupRequestForm from "@/components/PickupRequestForm";
import NonprofitBinsBooker from "@/components/NonprofitBinsBooker";
import AppointmentRequestForm from "@/components/AppointmentRequestForm";
import TaxReceiptSection from "@/components/TaxReceiptSection";
import AgreementDownloadButton from "@/components/AgreementDownloadButton";
import AppointmentQuoteCard from "@/components/AppointmentQuoteCard";

const APPT_STATUS_COLORS = {
  requested:  "bg-yellow-100 text-yellow-800",
  scheduled:  "bg-blue-100 text-blue-800",
  completed:  "bg-green-100 text-green-800",
  cancelled:  "bg-gray-100 text-gray-600",
};

// section: null | "pickup" | "bags" | "inventory" | "receipts"
export default function NonprofitDashboardClient({ app, program, user, appointments, pendingAppt, recentPickups }) {
  const [section, setSection] = useState(null);
  const [inventoryTab, setInventoryTab] = useState("bins"); // "bins" | "delivery"

  const firstName = app?.contact_name?.split(" ")[0] || "Partner";
  const status = getProgramStatusPresentation(program?.lifecycleStatus || "active");
  const accountType = program?.accountType || app?.account_type;
  const sinceDate = program?.startedAt || app?.created_at;
  const orgName = program?.legalName || app?.org_name;
  const signedAs = program?.agreementSignerName || app?.contract_signed_name;
  const agreedAt = program?.agreementSignedAt || app?.contract_agreed_at;

  function SectionHeader({ title, back }) {
    return (
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => { setSection(null); }}
          className="text-nct-navy hover:text-nct-navy-dark font-bold text-lg leading-none"
        >
          ←
        </button>
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
          Tell us how full your donation bags are. NCT will add you to an upcoming route and confirm your pickup date.
        </p>
        <PickupRequestForm onBack={() => setSection(null)} />
      </div>
    );
  }

  // ── Section: Log Bag Count ──
  if (section === "bags") {
    return (
      <div>
        <SectionHeader title="Log Bag Count" />
        <p className="text-sm text-gray-500 mb-4">
          Record how many donation bags are currently ready so NCT can see your latest pickup volume.
        </p>
        <BagCountForm />
        <button onClick={() => setSection(null)} className="w-full text-sm text-gray-500 hover:text-gray-700 py-3 underline mt-4">
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  // ── Section: Request Inventory ──
  if (section === "inventory") {
    return (
      <div>
        <SectionHeader title="Request Inventory" />

        {/* Pending appointment notice */}
        {pendingAppt && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-blue-800">
              You have a {pendingAppt.appointment_type === "in_person" ? "bins visit" : "delivery"} appointment
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full ml-2 ${APPT_STATUS_COLORS[pendingAppt.status]}`}>
                {pendingAppt.status}
              </span>
            </p>
            {pendingAppt.scheduled_date && (
              <p className="text-sm text-blue-700 mt-1">
                {new Date(pendingAppt.scheduled_date + "T12:00:00").toLocaleDateString()}
                {pendingAppt.scheduled_time ? ` at ${pendingAppt.scheduled_time}` : ""}
              </p>
            )}
            {pendingAppt.admin_notes && pendingAppt.quote_status !== "quoted" && (
              <p className="text-sm text-blue-600 mt-1">Note from NCT: {pendingAppt.admin_notes}</p>
            )}
            {pendingAppt.quote_status === "quoted" && (
              <AppointmentQuoteCard appt={pendingAppt} />
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setInventoryTab("bins")}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors
              ${inventoryTab === "bins" ? "bg-nct-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            In-Person Bins Visit
          </button>
          <button
            onClick={() => setInventoryTab("delivery")}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-colors
              ${inventoryTab === "delivery" ? "bg-nct-navy text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            Delivery (We Ship)
          </button>
        </div>

        {inventoryTab === "bins" ? (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Book a bins sourcing visit for up to 2 volunteers — 12PM–4PM on shopping days. One guaranteed spot per org per day.
            </p>
            <NonprofitBinsBooker />
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Request an inventory delivery. We'll ship sorted clothing to you. Quotes are provided before fulfillment.
            </p>
            <AppointmentRequestForm deliveryOnly />
          </div>
        )}

        <button onClick={() => setSection(null)} className="w-full text-sm text-gray-500 hover:text-gray-700 py-3 underline mt-4">
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  // ── Section: View Receipts ──
  if (section === "receipts") {
    return (
      <div>
        <SectionHeader title="Tax Receipts" />
        <TaxReceiptSection />
        <button onClick={() => setSection(null)} className="w-full text-sm text-gray-500 hover:text-gray-700 py-3 underline mt-4">
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  // ── Main Dashboard ──
  return (
    <div>
      {/* Header */}
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
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Since</p>
          <p className="text-sm font-bold text-nct-navy">
            {sinceDate ? new Date(sinceDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
          </p>
        </div>
      </div>

      {/* Action buttons */}
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
            <p className="text-sm text-gray-500 group-hover:text-white/80">Tell us your fill level — we'll add you to the next route.</p>
          </div>
          <span className="ml-auto text-gray-400 group-hover:text-white text-xl">›</span>
        </button>

        {accountType !== "fl" && (
          <button
            onClick={() => setSection("bags")}
            className="w-full flex items-center gap-4 bg-white border-2 border-gray-200 rounded-2xl p-5 hover:border-nct-navy group transition-colors text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-nct-navy/10 flex items-center justify-center shrink-0">
              <span className="text-2xl">🧺</span>
            </div>
            <div>
              <p className="font-bold text-nct-navy text-lg">Log Bag Count</p>
              <p className="text-sm text-gray-500">Add newly filled donation bags so your current pickup total stays accurate.</p>
            </div>
            <span className="ml-auto text-gray-400 text-xl">›</span>
          </button>
        )}

        <button
          onClick={() => setSection("inventory")}
          className="w-full flex items-center gap-4 bg-white border-2 border-gray-200 rounded-2xl p-5 hover:border-nct-navy group transition-colors text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-nct-navy/10 flex items-center justify-center shrink-0">
            <span className="text-2xl">📦</span>
          </div>
          <div>
            <p className="font-bold text-nct-navy text-lg">Request Inventory</p>
            <p className="text-sm text-gray-500">Book a bins visit or request a delivery from the warehouse.</p>
          </div>
          <span className="ml-auto text-gray-400 text-xl">›</span>
        </button>

        <button
          onClick={() => setSection("receipts")}
          className="w-full flex items-center gap-4 bg-white border-2 border-gray-200 rounded-2xl p-5 hover:border-nct-navy group transition-colors text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-nct-navy/10 flex items-center justify-center shrink-0">
            <span className="text-2xl">🧾</span>
          </div>
          <div>
            <p className="font-bold text-nct-navy text-lg">View Receipts</p>
            <p className="text-sm text-gray-500">Download tax donation receipts for your records.</p>
          </div>
          <span className="ml-auto text-gray-400 text-xl">›</span>
        </button>
      </div>

      {/* Recent Pickups */}
      {recentPickups && recentPickups.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <h3 className="font-bold text-nct-navy mb-3">Recent Pickups</h3>
          <div className="space-y-2">
            {recentPickups.map((p, i) => {
              const dateStr = p.pickup_routes?.scheduled_date
                ? new Date(p.pickup_routes.scheduled_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "—";
              return (
                <div key={i} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                  <div>
                    <span className="font-medium">{dateStr}</span>
                    {p.no_inventory
                      ? <span className="text-gray-400 ml-2 text-xs">No bags found</span>
                      : p.actual_bags != null && <span className="text-gray-500 ml-2">{p.actual_bags} bag{p.actual_bags !== 1 ? "s" : ""} collected</span>
                    }
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.no_inventory ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}`}>
                    {p.no_inventory ? "No inventory" : "Completed"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Appointment history */}
      {appointments && appointments.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <h3 className="font-bold text-nct-navy mb-3">Appointment History</h3>
          <div className="space-y-2">
            {appointments.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2">
                <div>
                  <span className="font-medium">{a.appointment_type === "in_person" ? "Bins Visit" : "Delivery"}</span>
                  {a.scheduled_date && (
                    <span className="text-gray-500 ml-2">{new Date(a.scheduled_date + "T12:00:00").toLocaleDateString()}</span>
                  )}
                  {!a.scheduled_date && a.preferred_date && (
                    <span className="text-gray-400 ml-2 text-xs">Pref: {new Date(a.preferred_date + "T12:00:00").toLocaleDateString()}</span>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${APPT_STATUS_COLORS[a.status]}`}>{a.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agreement on file */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <h3 className="font-bold text-nct-navy mb-3">Agreement on File</h3>
        <dl className="grid grid-cols-2 gap-3 text-sm mb-3">
          <div>
            <dt className="text-gray-500">Signed as</dt>
            <dd className="font-medium">{signedAs || "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Agreed on</dt>
            <dd className="font-medium">
              {agreedAt ? new Date(agreedAt).toLocaleDateString() : "—"}
            </dd>
          </div>
          {app?.ein && (
            <div>
              <dt className="text-gray-500">EIN</dt>
              <dd className="font-medium">{app.ein}</dd>
            </div>
          )}
        </dl>
        <AgreementDownloadButton />
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
