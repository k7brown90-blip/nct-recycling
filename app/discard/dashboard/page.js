import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import DiscardDashboardClient from "@/components/DiscardDashboardClient";

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

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <DiscardDashboardClient
        account={account}
        user={{ email: user.email }}
        pickups={pickups || []}
      />
    </main>
  );
}
