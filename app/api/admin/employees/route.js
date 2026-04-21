import { createServiceClient } from "@/lib/supabase";
import { upsertProfileRecord } from "@/lib/auth-profile";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

function buildAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function getEmployeeRedirectTo() {
  return `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/auth/update-password%3Fwelcome%3Dtrue`;
}

function buildEmployeeActivateUrl(actionLink) {
  return `${process.env.NEXT_PUBLIC_SITE_URL}/auth/activate?link=${encodeURIComponent(actionLink)}`;
}

async function sendEmployeeInviteEmail({ email, displayName, activateUrl, isResend = false }) {
  return resend.emails.send({
    from: "NCT Recycling <noreply@nctrecycling.com>",
    to: email,
    subject: isResend ? "Your fresh NCT Recycling employee setup link" : "Set up your NCT Recycling employee account",
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
        <div style="background:#0b2a45;padding:24px 32px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:22px">NCT Recycling</h1>
          <p style="color:#d49a22;margin:4px 0 0;font-size:13px;letter-spacing:1px;text-transform:uppercase">Employee Access</p>
        </div>
        <div style="background:#f9f9f9;padding:32px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px">
          <p style="font-size:16px;margin:0 0 12px">Hi ${displayName},</p>
          <p style="font-size:15px;margin:0 0 20px">
            ${isResend
              ? "Here is a fresh setup link for your NCT Recycling employee account. Use the button below to set your password and access the employee portal."
              : "Your NCT Recycling employee account is ready. Use the button below to set your password and access the employee portal."}
          </p>
          <p style="text-align:center;margin:28px 0">
            <a href="${activateUrl}"
               style="background:#d49a22;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;display:inline-block">
              Set Password &amp; Access Employee Portal →
            </a>
          </p>
          <p style="font-size:13px;color:#666;margin:20px 0 0">
            This link expires in 24 hours. If you need help, contact admin.
          </p>
        </div>
      </div>
    `,
  });
}

export async function GET(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from("employee_profiles")
    .select("id, auth_user_id, display_name, work_email, job_title, department, primary_location, employment_type, employment_status, last_clock_event_type, last_clock_event_at, created_at")
    .order("display_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ employees: data || [] });
}

export async function POST(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const {
    email,
    display_name,
    first_name,
    last_name,
    phone,
    job_title,
    department,
    primary_location,
    employment_type,
  } = await request.json();

  if (!email || !display_name) {
    return NextResponse.json({ error: "Email and display name are required." }, { status: 400 });
  }

  const adminClient = buildAdminClient();
  const redirectTo = getEmployeeRedirectTo();

  let linkData;
  const { data: inviteLinkData, error: inviteError } = await adminClient.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo,
      data: {
        role: "employee",
        full_name: display_name,
        setup_required: true,
      },
    },
  });

  if (inviteError) {
    const { data: recoveryData, error: recoveryError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (recoveryError) {
      return NextResponse.json({ error: recoveryError.message }, { status: 500 });
    }

    await adminClient.auth.admin.updateUserById(recoveryData.user.id, {
      user_metadata: {
        role: "employee",
        full_name: display_name,
        setup_required: true,
      },
    });

    linkData = recoveryData;
  } else {
    linkData = inviteLinkData;
  }

  const db = createServiceClient();

  try {
    await upsertProfileRecord({
      id: linkData.user.id,
      role: "employee",
      application_id: null,
      discard_account_id: null,
    }, db);
  } catch (profileError) {
    return NextResponse.json({ error: `Profile setup failed: ${profileError.message}` }, { status: 500 });
  }

  const employeePayload = {
    auth_user_id: linkData.user.id,
    display_name,
    first_name: first_name || null,
    last_name: last_name || null,
    work_email: email,
    phone: phone || null,
    job_title: job_title || null,
    department: department || null,
    primary_location: primary_location || null,
    employment_type: employment_type || "hourly",
  };

  const { data: employee, error: employeeError } = await db
    .from("employee_profiles")
    .upsert(employeePayload, { onConflict: "auth_user_id" })
    .select("id, display_name, work_email, job_title, department, primary_location, employment_status")
    .maybeSingle();

  if (employeeError) {
    return NextResponse.json({ error: employeeError.message }, { status: 500 });
  }

  const activateUrl = buildEmployeeActivateUrl(linkData.properties.action_link);

  const { error: emailError } = await sendEmployeeInviteEmail({
    email,
    displayName: display_name,
    activateUrl,
  });

  if (emailError) {
    return NextResponse.json({ error: "Employee created but invite email failed to send." }, { status: 500 });
  }

  return NextResponse.json({ success: true, employee });
}

export async function PATCH(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { employee_id } = await request.json();
  if (!employee_id) {
    return NextResponse.json({ error: "employee_id is required." }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: employee, error: employeeError } = await db
    .from("employee_profiles")
    .select("id, auth_user_id, display_name, work_email")
    .eq("id", employee_id)
    .maybeSingle();

  if (employeeError) {
    return NextResponse.json({ error: employeeError.message }, { status: 500 });
  }

  if (!employee?.auth_user_id || !employee?.work_email) {
    return NextResponse.json({ error: "Employee record is missing auth linkage or email." }, { status: 400 });
  }

  const adminClient = buildAdminClient();
  const redirectTo = getEmployeeRedirectTo();

  await adminClient.auth.admin.updateUserById(employee.auth_user_id, {
    user_metadata: {
      role: "employee",
      full_name: employee.display_name,
      setup_required: true,
    },
  });

  const { data: recoveryData, error: recoveryError } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email: employee.work_email,
    options: { redirectTo },
  });

  if (recoveryError || !recoveryData?.properties?.action_link) {
    return NextResponse.json({ error: recoveryError?.message || "Failed to generate a fresh invite link." }, { status: 500 });
  }

  const activateUrl = buildEmployeeActivateUrl(recoveryData.properties.action_link);
  const { error: emailError } = await sendEmployeeInviteEmail({
    email: employee.work_email,
    displayName: employee.display_name,
    activateUrl,
    isResend: true,
  });

  if (emailError) {
    return NextResponse.json({ error: "Fresh invite generated but email failed to send." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}