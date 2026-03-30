import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ResellerBookingsList from "@/components/ResellerBookingsList";

export const metadata = { title: "My Bookings — Reseller Portal" };

export default async function ResellerBookingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/reseller/dashboard" className="text-nct-navy hover:text-nct-navy-dark font-bold text-xl">←</Link>
        <h1 className="text-2xl font-bold text-nct-navy">My Bookings</h1>
      </div>
      <ResellerBookingsList />
    </main>
  );
}
