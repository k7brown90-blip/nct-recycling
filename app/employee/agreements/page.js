import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { activateEmployeeProfileByUserId } from "@/lib/employee-profile";
import { buildEmployeeAgreementSummary } from "@/lib/employee-acknowledgments";
import EmployeeAgreementsClient from "./EmployeeAgreementsClient";

export const metadata = { title: "My Agreements — NCT Employee Portal" };
export const dynamic = "force-dynamic";

export default async function EmployeeAgreementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);
  if (profile?.role !== "employee") redirect("/dashboard");

  const employee = await activateEmployeeProfileByUserId(user.id, db);
  if (!employee?.id) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-nct-navy mb-4">My Agreements</h1>
        <p className="text-gray-700">Your employee profile is not yet provisioned. Contact admin.</p>
      </main>
    );
  }

  const summary = await buildEmployeeAgreementSummary(employee.id, db);

  return (
    <main className="max-w-4xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-nct-navy">My Agreements</h1>
          <p className="text-sm text-gray-600 mt-1">
            Required documents for {employee.display_name}.
          </p>
        </div>
        <Link href="/employee" className="text-sm text-nct-navy hover:underline">
          ← Back to dashboard
        </Link>
      </div>

      {summary.onboardingBlocked && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900">
            <strong>Action required:</strong> You must sign the Employment Agreement before
            full portal access is unlocked.
          </p>
        </div>
      )}

      <EmployeeAgreementsClient
        employeeId={employee.id}
        employeeName={employee.display_name}
        pending={summary.pending}
        completed={summary.completed}
      />
    </main>
  );
}
