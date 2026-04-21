import { redirect } from "next/navigation";
import EmployeeDashboardClient from "@/components/EmployeeDashboardClient";
import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { activateEmployeeProfileByUserId, getEmployeeDashboardSnapshot } from "@/lib/employee-profile";

export const metadata = { title: "Employee Portal" };

export default async function EmployeePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);

  if (profile?.role !== "employee") redirect("/dashboard");

  const employee = await activateEmployeeProfileByUserId(user.id, db);
  const snapshot = await getEmployeeDashboardSnapshot(employee?.id, db);

  return <EmployeeDashboardClient employee={employee || { work_email: user.email }} initialSnapshot={snapshot} />;
}