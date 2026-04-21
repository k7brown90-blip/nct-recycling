import { createClient } from "@/lib/supabase-server";
import { getCanonicalDiscardPickups } from "@/lib/discard-canonical";
import { getCanonicalProgramSnapshot } from "@/lib/organization-status";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { redirect } from "next/navigation";
import DiscardDashboardClient from "@/components/DiscardDashboardClient";

export const metadata = { title: "Partner Portal — NCT Recycling" };

export default async function DiscardDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);

  if (profile?.role !== "discard") redirect("/dashboard");

  const [{ data: account }, { data: legacyPickups }, canonicalProgram, canonicalPickups] = await Promise.all([
    db.from("discard_accounts").select("*").eq("id", profile.discard_account_id).maybeSingle(),
    db.from("discard_pickups").select("*").eq("account_id", profile.discard_account_id)
      .order("pickup_date", { ascending: false }).limit(20),
    getCanonicalProgramSnapshot(db, "discard_accounts", profile.discard_account_id),
    getCanonicalDiscardPickups(db, profile.discard_account_id),
  ]);

  const pickups = (canonicalPickups && canonicalPickups.length)
    ? canonicalPickups
    : (legacyPickups || []);

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <DiscardDashboardClient
        account={account}
        program={canonicalProgram}
        user={{ email: user.email }}
        pickups={pickups || []}
      />
    </main>
  );
}
