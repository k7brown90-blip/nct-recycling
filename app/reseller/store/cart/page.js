import Link from "next/link";
import { redirect } from "next/navigation";
import ResellerCartClient from "@/components/ResellerCartClient";
import SignOutButton from "@/components/SignOutButton";
import { canAccessResellerStore, getCurrentResellerContext } from "@/lib/reseller-auth";

export const metadata = { title: "Reseller Cart" };

export default async function ResellerCartPage() {
  const { user, reseller } = await getCurrentResellerContext();

  if (!user) redirect("/login?next=/reseller/store/cart");
  if (!canAccessResellerStore(reseller)) redirect("/dashboard");

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/reseller/store" className="text-nct-navy hover:text-nct-navy-dark font-bold text-xl">←</Link>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Protected Reseller Cart</p>
          </div>
          <h1 className="text-3xl font-bold text-nct-navy">{reseller.business_name || reseller.full_name}</h1>
          <p className="text-sm text-gray-500 mt-1">{user.email}</p>
        </div>
        <SignOutButton />
      </div>

      <ResellerCartClient initialReseller={reseller} />
    </main>
  );
}