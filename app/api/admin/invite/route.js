import { createServiceClient } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

export async function POST(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { application_id, email, full_name, role } = await request.json();

  if (!application_id || !email || !role) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  // Use admin client (service role) to invite user via Supabase Auth
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      data: { role, application_id, setup_required: true },
    }
  );

  if (inviteError) {
    console.error("Invite error:", inviteError);
    return NextResponse.json({ error: inviteError.message }, { status: 500 });
  }

  const db = createServiceClient();

  // Create profile record
  await db.from("profiles").upsert({
    id: inviteData.user.id,
    role,
    application_id,
  });

  // Mark application as approved
  await db
    .from(role === "nonprofit" ? "nonprofit_applications" : "reseller_applications")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", application_id);

  return NextResponse.json({ success: true });
}
