import Link from "next/link";
import { redirect } from "next/navigation";
import ResellerStoreSummary from "@/components/ResellerStoreSummary";
import SignOutButton from "@/components/SignOutButton";
import { getCurrentResellerContext } from "@/lib/reseller-auth";

export const metadata = { title: "Reseller Dashboard" };

export default async function ResellerDashboard() {
  const { user, reseller } = await getCurrentResellerContext();

  if (!user) redirect("/login");
  if (!reseller) redirect("/dashboard");

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-nct-navy">
            Welcome, {reseller?.full_name?.split(" ")[0] || "Partner"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{user.email}</p>
        </div>
        <SignOutButton />
      </div>

      {/* Status row */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-green-50 border border-green-300 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Status</p>
          <p className="text-lg font-bold text-green-800 capitalize">{reseller?.status || "Approved"}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tier</p>
          <p className="text-sm font-bold text-nct-navy capitalize">
            {reseller?.tier === "employee" ? "Employee" : "Public"}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {reseller?.wants_warehouse_access ? "Warehouse access on file" : "Online buyer"}
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Since</p>
          <p className="text-sm font-bold text-nct-navy">
            {reseller?.created_at ? new Date(reseller.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <ResellerStoreSummary />
      </div>

      {/* Getting started guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-5">
        <h2 className="font-bold text-nct-navy mb-2">Getting Started</h2>
        <p className="text-sm text-gray-700 mb-3">
          Welcome to your NCT reseller portal. Here is how to use it:
        </p>
        <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
          <li>
            <span className="font-semibold text-nct-navy">Open the reseller store</span> to browse curated lots and current inventory.
          </li>
          <li>
            <span className="font-semibold text-nct-navy">Add items to your cart</span>, then open the cart to review and create your order.
          </li>
          <li>
            <span className="font-semibold text-nct-navy">Pay securely</span> through the Shopify checkout link we generate for your order.
          </li>
          <li>
            <span className="font-semibold text-nct-navy">Track your order</span> from the Order History page anytime.
          </li>
        </ol>
        <div className="flex flex-wrap gap-3 mt-4">
          <Link href="/reseller/store" className="inline-flex items-center justify-center bg-nct-navy hover:bg-nct-navy-dark text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
            Open Reseller Store
          </Link>
          <Link href="/reseller/store/cart" className="inline-flex items-center justify-center border border-nct-navy text-nct-navy hover:bg-nct-navy hover:text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
            View Cart
          </Link>
          <Link href="/reseller/store/orders" className="inline-flex items-center justify-center border border-nct-navy text-nct-navy hover:bg-nct-navy hover:text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
            Order History
          </Link>
          <a href="mailto:donate@nctrecycling.com" className="inline-flex items-center justify-center text-sm font-semibold text-nct-navy underline px-2 py-2.5">
            Need help? Email us
          </a>
        </div>
      </div>

      {/* Agreement on file */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <h2 className="font-bold text-nct-navy mb-3">Agreement on File</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-gray-500">Agreement</dt>
            <dd className="font-medium">{reseller?.agreement_version || (reseller?.wants_warehouse_access ? "—" : "Not required (online only)")}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Warehouse access</dt>
            <dd className="font-medium">{reseller?.wants_warehouse_access ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Signed as</dt>
            <dd className="font-medium">{reseller?.contract_signed_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Agreed on</dt>
            <dd className="font-medium">
              {reseller?.contract_agreed_at ? new Date(reseller.contract_agreed_at).toLocaleDateString() : "—"}
            </dd>
          </div>
          {reseller?.business_name && (
            <div>
              <dt className="text-gray-500">Business</dt>
              <dd className="font-medium">{reseller.business_name}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Location */}
      <div className="bg-nct-navy text-white rounded-xl p-5">
        <h2 className="font-bold mb-2">Operations & Pickup</h2>
        <div className="text-sm space-y-1 text-gray-200">
          <p>📍 6108 South College Ave, STE C — Fort Collins, CO 80525</p>
          <p>📦 Route inventory is sorted on site by the NCT team</p>
          <p>🛒 Browse the protected catalog and check out from your reseller store inside the portal</p>
          <p>☀ Sunday bin sale remains open to the public on Sundays, 12PM–4PM</p>
        </div>
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          <Link href="/reseller/store" className="text-nct-gold underline">Open reseller store</Link>
          <a href="tel:+19702329108" className="text-nct-gold underline">(970) 232-9108</a>
          <a href="mailto:donate@nctrecycling.com" className="text-nct-gold underline">donate@nctrecycling.com</a>
        </div>
      </div>
    </main>
  );
}
