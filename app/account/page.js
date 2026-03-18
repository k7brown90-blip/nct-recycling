import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Link from "next/link";
import AccountSettingsForm from "@/components/AccountSettingsForm";

export const metadata = { title: "Account Settings | NCT Recycling" };

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createServiceClient();

  const { data: profile } = await db
    .from("profiles")
    .select("role, application_id")
    .eq("id", user.id)
    .maybeSingle();

  let appData = null;
  if (profile?.application_id) {
    const table = profile.role === "nonprofit" ? "nonprofit_applications" : "reseller_applications";
    const { data } = await db.from(table).select("*").eq("id", profile.application_id).maybeSingle();
    appData = data;
  }

  // Determine where the back link goes
  const dashboardHref = profile?.role === "nonprofit" ? "/nonprofit/dashboard"
    : profile?.role === "reseller" ? "/reseller/dashboard"
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
        email={user.email}
      />
    </main>
  );
}
