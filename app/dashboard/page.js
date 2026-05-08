import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Look up their profile to determine role
  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);

  // Only forward to a role-specific dashboard when the profile has the
  // linkage that dashboard requires. Otherwise we'd ping-pong between
  // /dashboard and the role dashboard (which redirects back here when it
  // can't find its underlying record).
  const role = profile?.role;
  const hasAppLink = Boolean(profile?.application_id);
  const hasDiscardLink = Boolean(profile?.discard_account_id);

  if (role === "nonprofit" && hasAppLink) redirect("/nonprofit/dashboard");
  if ((role === "reseller" || role === "both") && hasAppLink) redirect("/reseller/dashboard");
  if (role === "discard" && hasDiscardLink) redirect("/discard/dashboard");
  if (role === "employee") redirect("/employee");

  // No profile yet, or profile is missing its linkage — show a holding page.
  return (
    <main className="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-nct-navy mb-4">Welcome</h1>
      <p className="text-gray-600">
        {role
          ? "We could not find your partner record linked to this login. Please contact us so we can finish setting up your account."
          : "Your account is being set up. Please contact us if you need assistance."}
      </p>
      <p className="mt-4">
        <a href="mailto:donate@nctrecycling.com" className="text-nct-navy underline">
          donate@nctrecycling.com
        </a>
      </p>
    </main>
  );
}
