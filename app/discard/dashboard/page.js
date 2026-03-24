import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import DiscardBagCountForm from "@/components/DiscardBagCountForm";
import DiscardPickupRequestForm from "@/components/DiscardPickupRequestForm";

export const metadata = { title: "Partner Portal — NCT Recycling" };

export default async function DiscardDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createServiceClient();

  const { data: profile } = await db
    .from("profiles")
    .select("role, discard_account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "discard") redirect("/dashboard");

  const [{ data: account }, { data: pickups }] = await Promise.all([
    db.from("discard_accounts").select("*").eq("id", profile.discard_account_id).maybeSingle(),
    db.from("discard_pickups").select("*").eq("account_id", profile.discard_account_id)
      .order("pickup_date", { ascending: false }).limit(20),
  ]);

  const pending = (pickups || []).filter((p) => p.payment_status === "pending");
  const outstanding = pending.reduce((s, p) => s + parseFloat(p.amount_owed || 0), 0);

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-nct-navy">
            Welcome, {account?.contact_name?.split(" ")[0] || "Partner"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{account?.org_name} · {user.email}</p>
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
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Account Type</p>
          <p className="text-xl font-bold text-nct-navy">
            {account?.account_type === "fl" ? "Full Load (FL)" : "LTL Partner"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {account?.account_type === "fl" ? "Container-based pickup" : "Weight-tracked pickup"}
          </p>
        </div>
        <div className={`rounded-xl p-5 border ${outstanding > 0 ? "bg-yellow-50 border-yellow-300" : "bg-gray-50 border-gray-200"}`}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Balance Owed to You</p>
          <p className={`text-2xl font-bold ${outstanding > 0 ? "text-yellow-700" : "text-gray-400"}`}>
            ${outstanding.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">pending payment from NCT</p>
        </div>
      </div>

      {/* Bag Count — LTL only */}
      {account?.account_type !== "fl" && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="font-bold text-nct-navy text-lg mb-1">Bag Count</h2>
          <p className="text-sm text-gray-500 mb-4">
            Keep this updated so NCT can plan your pickup accurately. Add bags as they accumulate.
          </p>
          <DiscardBagCountForm />
        </div>
      )}

      {/* Request a Pickup */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="font-bold text-nct-navy text-lg mb-1">Request a Pickup</h2>
        <p className="text-sm text-gray-500 mb-4">
          Let us know when you're ready for a pickup. We'll confirm a date and time with you.
        </p>
        <DiscardPickupRequestForm />
      </div>

      {/* Pickup History */}
      {pickups && pickups.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="font-bold text-nct-navy text-lg mb-4">Pickup History</h2>
          <div className="space-y-3">
            {pickups.map((p) => (
              <div key={p.id} className="flex items-start justify-between text-sm border-b border-gray-50 pb-3 last:border-0 last:pb-0">
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
      )}

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
