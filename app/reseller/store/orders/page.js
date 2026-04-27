import Link from "next/link";
import { redirect } from "next/navigation";
import ResellerOrdersClient from "@/components/ResellerOrdersClient";
import SignOutButton from "@/components/SignOutButton";
import { canAccessResellerStore, getCurrentResellerContext } from "@/lib/reseller-auth";

export const metadata = { title: "Reseller Orders" };

export default async function ResellerOrdersPage() {
  const { user, reseller } = await getCurrentResellerContext();

  if (!user) redirect("/login?next=/reseller/store/orders");
  if (!canAccessResellerStore(reseller)) redirect("/dashboard");

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/reseller/store" className="text-nct-navy hover:text-nct-navy-dark font-bold text-xl">←</Link>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Reseller Order History</p>
          </div>
          <h1 className="text-3xl font-bold text-nct-navy">{reseller.business_name || reseller.full_name}</h1>
          <p className="text-sm text-gray-500 mt-1">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/reseller/store/cart" className="inline-flex items-center justify-center rounded-xl border border-nct-navy px-4 py-2.5 text-sm font-semibold text-nct-navy transition-colors hover:bg-nct-navy hover:text-white">
            View Cart
          </Link>
          <SignOutButton />
        </div>
      </div>

      <ResellerOrdersClient initialReseller={reseller} />
    </main>
  );
}