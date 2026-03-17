import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import BagCountForm from "@/components/BagCountForm";
import AppointmentRequestForm from "@/components/AppointmentRequestForm";
import NonprofitBinsBooker from "@/components/NonprofitBinsBooker";

export const metadata = { title: "Nonprofit Partner Portal" };

const APPT_STATUS_COLORS = {
  requested:  "bg-yellow-100 text-yellow-800",
  scheduled:  "bg-blue-100 text-blue-800",
  completed:  "bg-green-100 text-green-800",
  cancelled:  "bg-gray-100 text-gray-600",
};

export default async function NonprofitDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createServiceClient();

  const { data: profile } = await db
    .from("profiles")
    .select("role, application_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "nonprofit") redirect("/dashboard");

  const [
    { data: app },
    { data: receipts },
    { data: bagHistory },
    { data: appointments },
  ] = await Promise.all([
    db.from("nonprofit_applications").select("*").eq("id", profile.application_id).maybeSingle(),
    db.from("tax_receipts").select("*").eq("application_id", profile.application_id).order("created_at", { ascending: false }),
    db.from("bag_counts").select("*").eq("nonprofit_id", profile.application_id).order("created_at", { ascending: false }).limit(5),
    db.from("exchange_appointments").select("*").eq("nonprofit_id", profile.application_id).order("created_at", { ascending: false }),
  ]);

  const currentBagCount = bagHistory?.[0]?.bag_count ?? null;
  const totalPieces = receipts?.reduce((sum, r) => sum + (r.piece_count || 0), 0) ?? 0;
  const totalValue = receipts?.reduce((sum, r) => sum + parseFloat(r.total_value || 0), 0) ?? 0;
  const pendingAppt = appointments?.find((a) => a.status === "requested" || a.status === "scheduled");

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-nct-navy">
            Welcome, {app?.contact_name?.split(" ")[0] || "Partner"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{app?.org_name} · {user.email}</p>
        </div>
        <SignOutButton />
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="bg-green-50 border border-green-300 rounded-xl p-5">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Status</p>
          <p className="text-2xl font-bold text-green-800">✅ Active</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Bags on Record</p>
          <p className="text-2xl font-bold text-nct-navy">{currentBagCount ?? "—"}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Partner Since</p>
          <p className="text-lg font-bold text-nct-navy">
            {app?.created_at ? new Date(app.created_at).toLocaleDateString() : "—"}
          </p>
        </div>
      </div>

      {/* Bag count updater */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-bold text-nct-navy text-lg mb-1">Donation Bag Count</h2>
        <p className="text-sm text-gray-500 mb-4">
          Keep this updated so NCT can accurately plan pickup routes. Update any time your storage level changes.
        </p>
        <BagCountForm currentCount={currentBagCount} />
        {bagHistory && bagHistory.length > 1 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-2">Recent updates</p>
            <div className="space-y-1">
              {bagHistory.slice(1, 4).map((b) => (
                <div key={b.id} className="flex justify-between text-xs text-gray-400">
                  <span>{new Date(b.created_at).toLocaleDateString()} — {b.bag_count} bags{b.notes ? ` (${b.notes})` : ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Nonprofit bins booking */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-bold text-nct-navy text-lg mb-1">Schedule a Bins Visit</h2>
        <p className="text-sm text-gray-500 mb-4">
          Book a bins sourcing visit for up to 2 volunteers. Available 12:00 PM – 4:00 PM on shopping days.
          Bins are restocked fresh each shopping day from incoming loads.
        </p>
        <NonprofitBinsBooker />
      </div>

      {/* Exchange appointment scheduler */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-bold text-nct-navy text-lg mb-1">Schedule Exchange Appointment</h2>
        <p className="text-sm text-gray-500 mb-4">
          Request inventory from the NCT warehouse. Choose in-person (you sort) or delivery (we ship to you).
        </p>

        {pendingAppt ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-blue-800">
              You have a {pendingAppt.appointment_type === "in_person" ? "in-person" : "delivery"} appointment{" "}
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full ml-1 ${APPT_STATUS_COLORS[pendingAppt.status]}`}>
                {pendingAppt.status}
              </span>
            </p>
            {pendingAppt.scheduled_date && (
              <p className="text-sm text-blue-700 mt-1">
                Scheduled: {new Date(pendingAppt.scheduled_date).toLocaleDateString()}
                {pendingAppt.scheduled_time ? ` at ${pendingAppt.scheduled_time}` : ""}
              </p>
            )}
            {pendingAppt.admin_notes && (
              <p className="text-sm text-blue-600 mt-1">Note from NCT: {pendingAppt.admin_notes}</p>
            )}
          </div>
        ) : null}

        <AppointmentRequestForm />
      </div>

      {/* Appointment history */}
      {appointments && appointments.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="font-bold text-nct-navy text-lg mb-4">Appointment History</h2>
          <div className="space-y-2">
            {appointments.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2">
                <div>
                  <span className="font-medium capitalize">{a.appointment_type === "in_person" ? "In-Person" : "Delivery"}</span>
                  {a.scheduled_date && (
                    <span className="text-gray-500 ml-2">{new Date(a.scheduled_date).toLocaleDateString()}</span>
                  )}
                  {!a.scheduled_date && a.preferred_date && (
                    <span className="text-gray-400 ml-2">Preferred: {new Date(a.preferred_date).toLocaleDateString()}</span>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${APPT_STATUS_COLORS[a.status]}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tax receipt summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-bold text-nct-navy text-lg mb-4">Donation Summary</h2>
        <div className="grid grid-cols-2 gap-4 text-center mb-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-3xl font-bold text-nct-navy">{totalPieces.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">Total Pieces Donated</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-3xl font-bold text-green-700">
              ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-gray-500 mt-1">Total Tax Receipt Value</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center">
          Donations valued at $5.00/piece per NCT Recycling records per IRC § 170.
        </p>
        {receipts && receipts.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="pb-2 text-gray-500 font-medium">Date</th>
                  <th className="pb-2 text-gray-500 font-medium">Pieces</th>
                  <th className="pb-2 text-gray-500 font-medium">Value</th>
                  <th className="pb-2 text-gray-500 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {receipts.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 text-gray-700">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="py-2 font-medium">{r.piece_count?.toLocaleString() ?? "—"}</td>
                    <td className="py-2 text-green-700 font-medium">
                      ${parseFloat(r.total_value || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 text-gray-500">{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Agreement on file */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-bold text-nct-navy text-lg mb-3">Agreement on File</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-gray-500">Signed as</dt>
            <dd className="font-medium">{app?.contract_signed_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Agreed on</dt>
            <dd className="font-medium">
              {app?.contract_agreed_at ? new Date(app.contract_agreed_at).toLocaleDateString() : "—"}
            </dd>
          </div>
          {app?.ein && (
            <div>
              <dt className="text-gray-500">EIN</dt>
              <dd className="font-medium">{app.ein}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Contact */}
      <div className="bg-nct-navy text-white rounded-xl p-6">
        <h2 className="font-bold text-lg mb-3">Questions? Contact Us</h2>
        <div className="text-sm space-y-1 text-gray-200">
          <p>📍 6108 South College Ave, STE C — Fort Collins, CO 80525</p>
          <p>🕐 Mon–Thu 10am–4pm</p>
        </div>
        <div className="flex gap-4 mt-3 text-sm">
          <a href="tel:+19702329108" className="text-nct-gold underline">(970) 232-9108</a>
          <a href="mailto:donate@nctrecycling.com" className="text-nct-gold underline">donate@nctrecycling.com</a>
        </div>
      </div>
    </main>
  );
}
