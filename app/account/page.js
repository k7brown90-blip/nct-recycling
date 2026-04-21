import { createClient } from "@/lib/supabase-server";
import { getCanonicalProgramSnapshot } from "@/lib/organization-status";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { redirect } from "next/navigation";
import Link from "next/link";
import AccountSettingsForm from "@/components/AccountSettingsForm";

export const metadata = { title: "Account Settings | NCT Recycling" };

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);

  let appData = null;
  let program = null;
  if (profile?.role === "nonprofit" && profile?.application_id) {
    const [{ data }, canonicalProgram] = await Promise.all([
      db.from("nonprofit_applications").select("*").eq("id", profile.application_id).maybeSingle(),
      getCanonicalProgramSnapshot(db, "nonprofit_applications", profile.application_id),
    ]);
    appData = data;
    program = canonicalProgram;
  } else if ((profile?.role === "reseller" || profile?.role === "both") && profile?.application_id) {
    const { data } = await db.from("reseller_applications").select("*").eq("id", profile.application_id).maybeSingle();
    appData = data;
  } else if (profile?.role === "discard" && profile?.discard_account_id) {
    const [{ data }, canonicalProgram] = await Promise.all([
      db.from("discard_accounts").select("*").eq("id", profile.discard_account_id).maybeSingle(),
      getCanonicalProgramSnapshot(db, "discard_accounts", profile.discard_account_id),
    ]);
    appData = data;
    program = canonicalProgram;
  }

  // Determine where the back link goes
  const dashboardHref = profile?.role === "nonprofit" ? "/nonprofit/dashboard"
    : profile?.role === "discard" ? "/discard/dashboard"
    : (profile?.role === "reseller" || profile?.role === "both") ? "/reseller/dashboard"
    : "/dashboard";

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link href={dashboardHref} className="text-sm text-gray-500 hover:text-nct-navy transition-colors">
          ← Back to dashboard
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-nct-navy mb-1">Account Settings</h1>
        <p className="text-gray-500 text-sm">{user.email}</p>
      </div>

      <AccountSettingsForm
        role={profile?.role}
        appData={appData}
        program={program}
        email={user.email}
      />
    </main>
  );
}
