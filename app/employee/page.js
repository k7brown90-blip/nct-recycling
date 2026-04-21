import { redirect } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { getEmployeeProfileByUserId } from "@/lib/employee-profile";

export const metadata = { title: "Employee Portal" };

function formatDateTime(value) {
  if (!value) return "Not clocked in";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function EmployeePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);

  if (profile?.role !== "employee") redirect("/dashboard");

  const employee = await getEmployeeProfileByUserId(user.id, db);

  return (
    <main className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-nct-gold mb-2">
            Internal Workforce
          </p>
          <h1 className="text-3xl font-bold text-nct-navy">
            {employee?.display_name || user.user_metadata?.full_name || user.email || "Employee Portal"}
          </h1>
          <p className="text-gray-500 mt-1">
            Phase 1 foundation: employee identity, schedule shell, and labor tracking entry point.
          </p>
        </div>
        <SignOutButton />
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <section className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Role</p>
          <p className="text-lg font-bold text-nct-navy">{employee?.job_title || "Employee"}</p>
          <p className="text-sm text-gray-500 mt-2">{employee?.employment_status || "pending_setup"}</p>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Primary Location</p>
          <p className="text-lg font-bold text-nct-navy">{employee?.primary_location || "NCT Recycling"}</p>
          <p className="text-sm text-gray-500 mt-2">{employee?.work_email || user.email || "No work email on file"}</p>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Clock Status</p>
          <p className="text-lg font-bold text-nct-navy">
            {employee?.last_clock_event_type === "clock_in" ? "Clocked In" : "Awaiting Shift"}
          </p>
          <p className="text-sm text-gray-500 mt-2">{formatDateTime(employee?.last_clock_event_at)}</p>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-nct-navy mb-3">What this portal will handle</h2>
          <div className="grid gap-3 md:grid-cols-2 text-sm text-gray-700">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">Clock in, clock out, and break tracking</div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">Employee manual time entry submission</div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">Assigned shifts and upcoming work schedule</div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">Time-off requests and availability management</div>
          </div>
        </section>

        <section className="bg-nct-navy text-white rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-3">Setup status</h2>
          <div className="space-y-3 text-sm text-slate-200">
            <p>Employee auth routing is active.</p>
            <p>Workforce schema is ready for migration.</p>
            <p>Schedule, clock, and approval APIs are the next implementation slice.</p>
          </div>
        </section>
      </div>
    </main>
  );
}