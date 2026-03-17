import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";

export const metadata = { title: "Nonprofit Partner Portal" };

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

  const { data: app } = await db
    .from("nonprofit_applications")
    .select("*")
    .eq("id", profile.application_id)
    .maybeSingle();

  const { data: receipts } = await db
    .from("tax_receipts")
    .select("*")
    .eq("application_id", profile.application_id)
    .order("created_at", { ascending: false });

  const totalPieces = receipts?.reduce((sum, r) => sum + (r.piece_count || 0), 0) ?? 0;
  const totalValue = receipts?.reduce((sum, r) => sum + parseFloat(r.total_value || 0), 0) ?? 0;

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        <div className="bg-green-50 border border-green-300 rounded-xl p-5">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Status</p>
          <p className="text-2xl font-bold text-green-800">✅ Approved</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Program Type</p>
          <p className="text-lg font-bold text-nct-navy capitalize">{app?.program_type || "—"}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Partner Since</p>
          <p className="text-lg font-bold text-nct-navy">
            {app?.created_at ? new Date(app.created_at).toLocaleDateString() : "—"}
          </p>
        </div>
      </div>

      {/* Tax receipt summary */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-bold text-nct-navy text-lg mb-4">Donation Summary</h2>
        <div className="grid grid-cols-2 gap-4 text-center mb-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-3xl font-bold text-nct-navy">{totalPieces.toLocaleString()}</p>
            <p className="text-sm text-gray-500 mt-1">Total Pieces Donated</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-3xl font-bold text-green-700">${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            <p className="text-sm text-gray-500 mt-1">Total Tax Receipt Value</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center">
          Donations valued at $5.00/piece per NCT Recycling records per IRC § 170.
        </p>
      </div>

      {/* Tax receipts table */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-bold text-nct-navy text-lg mb-4">Tax Receipts</h2>
        {!receipts || receipts.length === 0 ? (
          <p className="text-gray-400 text-sm">No tax receipts on file yet.</p>
        ) : (
          <div className="overflow-x-auto">
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
          {app?.org_type && (
            <div>
              <dt className="text-gray-500">Organization Type</dt>
              <dd className="font-medium capitalize">{app.org_type}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Warehouse access info (onsite partners) */}
      {(app?.program_type === "onsite" || app?.program_type === "both") && (
        <div className="bg-nct-navy text-white rounded-xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-3">Warehouse Access</h2>
          <div className="text-sm space-y-1 text-gray-200">
            <p>📍 6108 South College Ave, STE C — Fort Collins, CO 80525</p>
            <p>📅 Mondays only, by appointment — Bins Area access</p>
            <p>🕐 During normal operating hours (Mon–Thu 10am–4pm)</p>
          </div>
          <div className="flex gap-4 mt-4 text-sm">
            <a href="tel:+19702329108" className="text-nct-gold underline">(970) 232-9108</a>
            <a href="mailto:donate@nctrecycling.com" className="text-nct-gold underline">donate@nctrecycling.com</a>
          </div>
        </div>
      )}

      {/* Coming soon */}
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-6 text-sm text-amber-800">
        <strong>Coming Soon:</strong> Warehouse appointment scheduling, pickup requests, and donation history uploads will be available here once the portal is fully launched.
      </div>
    </main>
  );
}
