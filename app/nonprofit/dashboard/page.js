import { createClient } from "@/lib/supabase-server";
import { getCanonicalCoOpRecentPickups } from "@/lib/co-op-canonical";
import { getCanonicalProgramSnapshot } from "@/lib/organization-status";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { redirect } from "next/navigation";
import NonprofitDashboardClient from "@/components/NonprofitDashboardClient";

export const metadata = { title: "Nonprofit Partner Portal" };

export default async function NonprofitDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);

  if (profile?.role !== "nonprofit") redirect("/dashboard");

  const [
    { data: app },
    { data: appointments },
    { data: legacyRecentPickups },
    canonicalProgram,
    canonicalRecentPickups,
  ] = await Promise.all([
    db.from("nonprofit_applications").select("*").eq("id", profile.application_id).maybeSingle(),
    db.from("exchange_appointments").select("*").eq("nonprofit_id", profile.application_id).order("created_at", { ascending: false }),
    db.from("pickup_route_stops")
      .select("actual_bags, completed_at, no_inventory, pickup_routes(scheduled_date)")
      .eq("nonprofit_id", profile.application_id)
      .eq("stop_status", "completed")
      .order("completed_at", { ascending: false })
      .limit(5),
    getCanonicalProgramSnapshot(db, "nonprofit_applications", profile.application_id),
    getCanonicalCoOpRecentPickups(db, profile.application_id, 5),
  ]);

  const recentPickups = (canonicalRecentPickups && canonicalRecentPickups.length)
    ? canonicalRecentPickups
    : (legacyRecentPickups || []);

  const pendingAppt = appointments?.find((a) => a.status === "requested" || a.status === "scheduled");

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <NonprofitDashboardClient
        app={app}
        program={canonicalProgram}
        user={{ email: user.email }}
        appointments={appointments || []}
        pendingAppt={pendingAppt || null}
        recentPickups={recentPickups || []}
      />
    </main>
  );
}
