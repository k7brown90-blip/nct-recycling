import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function buildClient(key) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    key,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request) {
  const { access_token, password, clear_setup_required } = await request.json();

  if (!access_token || typeof access_token !== "string") {
    return NextResponse.json({ error: "Recovery access token is required." }, { status: 400 });
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const publicClient = buildClient(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const {
    data: { user },
    error: userError,
  } = await publicClient.auth.getUser(access_token);

  if (userError || !user?.id) {
    return NextResponse.json({ error: "This invite or reset link is no longer valid." }, { status: 401 });
  }

  const adminClient = buildClient(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const metadata = clear_setup_required
    ? { ...(user.user_metadata || {}), setup_required: false }
    : user.user_metadata || {};

  const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
    password,
    user_metadata: metadata,
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message || "Failed to update password." }, { status: 500 });
  }

  if (clear_setup_required) {
    const { data: employeeProfile, error: employeeLookupError } = await adminClient
      .from("employee_profiles")
      .select("id, employment_status")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (employeeLookupError) {
      return NextResponse.json({ error: employeeLookupError.message || "Failed to look up employee profile." }, { status: 500 });
    }

    if (employeeProfile?.id && employeeProfile.employment_status === "pending_setup") {
      const { error: employeeUpdateError } = await adminClient
        .from("employee_profiles")
        .update({ employment_status: "active" })
        .eq("id", employeeProfile.id);

      if (employeeUpdateError) {
        return NextResponse.json({ error: employeeUpdateError.message || "Failed to activate employee profile." }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ success: true, email: user.email || null });
}