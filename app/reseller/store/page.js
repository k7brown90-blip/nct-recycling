import Link from "next/link";
import { redirect } from "next/navigation";
import ResellerStoreClient from "@/components/ResellerStoreClient";
import SignOutButton from "@/components/SignOutButton";
import { getCurrentResellerContext } from "@/lib/reseller-auth";

export const metadata = { title: "Reseller Store" };

export default async function ResellerStorePage() {
  const { user, reseller } = await getCurrentResellerContext();

  if (!user) redirect("/login");
  if (!reseller) redirect("/dashboard");

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/reseller/dashboard" className="text-nct-navy hover:text-nct-navy-dark font-bold text-xl">←</Link>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Protected Reseller Store</p>
          </div>
          <h1 className="text-3xl font-bold text-nct-navy">{reseller.business_name || reseller.full_name}</h1>
          <p className="text-sm text-gray-500 mt-1">{user.email}</p>
        </div>
        <SignOutButton />
      </div>

      <ResellerStoreClient initialReseller={reseller} />
    </main>
  );
}
