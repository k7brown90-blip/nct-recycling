import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

export const metadata = { title: "Reseller Dashboard" };

export default async function ResellerDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createServiceClient();

  // Get profile
  const { data: profile } = await db
    .from("profiles")
    .select("role, application_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "reseller") redirect("/dashboard");

  // Get application details
  const { data: app } = await db
    .from("reseller_applications")
    .select("*")
    .eq("id", profile.application_id)
    .maybeSingle();

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-nct-navy">
            Welcome, {app?.full_name?.split(" ")[0] || "Partner"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{user.email}</p>
        </div>
        <SignOutButton />
      </div>

      {/* Status card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        <div className="bg-green-50 border border-green-300 rounded-xl p-5">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Status</p>
          <p className="text-2xl font-bold text-green-800">✅ Approved</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Program</p>
          <p className="text-lg font-bold text-nct-navy capitalize">{app?.program_type || "—"}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Member Since</p>
          <p className="text-lg font-bold text-nct-navy">
            {app?.created_at ? new Date(app.created_at).toLocaleDateString() : "—"}
          </p>
        </div>
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
          {app?.business_name && (
            <div>
              <dt className="text-gray-500">Business</dt>
              <dd className="font-medium">{app.business_name}</dd>
            </div>
          )}
          {app?.tax_license_number && (
            <div>
              <dt className="text-gray-500">CO Tax License</dt>
              <dd className="font-medium">{app.tax_license_number}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Visit info */}
      <div className="bg-nct-navy text-white rounded-xl p-6 mb-6">
        <h2 className="font-bold text-lg mb-3">Ready to Visit?</h2>
        <div className="text-sm space-y-1 text-gray-200">
          <p>📍 6108 South College Ave, STE C — Fort Collins, CO 80525</p>
          <p>🕐 Boutique: Mon–Thu 10am–4pm &nbsp;|&nbsp; Bins: Mon–Thu 12pm–4pm</p>
          <p>📦 24/7 donation drop-off available on the east side of the building</p>
        </div>
        <div className="flex gap-4 mt-4 text-sm">
          <a href="tel:+19702329108" className="text-nct-gold underline">(970) 232-9108</a>
          <a href="mailto:donate@nctrecycling.com" className="text-nct-gold underline">donate@nctrecycling.com</a>
        </div>
      </div>

      {/* Coming soon */}
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-6 text-sm text-amber-800">
        <strong>Coming Soon:</strong> Load claiming, visit scheduling, and purchase history will be available here once the portal is fully launched.
      </div>
    </main>
  );
}

