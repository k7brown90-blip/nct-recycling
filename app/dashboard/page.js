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

  if (profile?.role === "nonprofit") redirect("/nonprofit/dashboard");
  if (profile?.role === "reseller" || profile?.role === "both") redirect("/reseller/dashboard");
  if (profile?.role === "discard") redirect("/discard/dashboard");
  if (profile?.role === "employee") redirect("/employee");

  // No profile yet — show a holding page
  return (
    <main className="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-nct-navy mb-4">Welcome</h1>
      <p className="text-gray-600">
        Your account is being set up. Please contact us if you need assistance.
      </p>
      <p className="mt-4">
        <a href="mailto:donate@nctrecycling.com" className="text-nct-navy underline">
          donate@nctrecycling.com
        </a>
      </p>
    </main>
  );
}
