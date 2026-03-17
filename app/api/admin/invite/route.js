import { createServiceClient } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

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

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Generate the invite link without sending Supabase's default email
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/update-password?welcome=true`,
      data: { role, application_id, setup_required: true },
    },
  });

  if (linkError) {
    console.error("Invite link error:", linkError);
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  const db = createServiceClient();

  // Create profile record
  await db.from("profiles").upsert({
    id: linkData.user.id,
    role,
    application_id,
  });

  // Mark application as approved
  await db
    .from(role === "nonprofit" ? "nonprofit_applications" : "reseller_applications")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", application_id);

  const portalLabel = role === "nonprofit" ? "Nonprofit Partner Portal" : "Retail Partner Portal";
  const greeting = full_name ? `Hi ${full_name},` : "Hi,";

  // Send branded invite email via Resend
  const { error: emailError } = await resend.emails.send({
    from: "NCT Recycling <noreply@nctrecycling.com>",
    to: email,
    subject: "You've been approved — Set up your NCT Recycling partner account",
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
        <div style="background:#0b2a45;padding:24px 32px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:22px">NCT Recycling</h1>
          <p style="color:#d49a22;margin:4px 0 0;font-size:13px;letter-spacing:1px;text-transform:uppercase">Fort Collins, CO</p>
        </div>
        <div style="background:#f9f9f9;padding:32px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px">
          <p style="font-size:16px;margin:0 0 12px">${greeting}</p>
          <p style="font-size:15px;margin:0 0 20px">
            Your application to the NCT Recycling Co-Op Network has been <strong>approved</strong>.
            Click the button below to set your password and access your <strong>${portalLabel}</strong>.
          </p>
          <p style="text-align:center;margin:28px 0">
            <a href="${linkData.properties.action_link}"
               style="background:#d49a22;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;display:inline-block">
              Set Password &amp; Access Portal →
            </a>
          </p>
          <p style="font-size:13px;color:#666;margin:20px 0 0">
            This link expires in 24 hours. If you have any questions, reply to this email or call us at (970) 232-9108.
          </p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />
          <p style="font-size:12px;color:#999;margin:0">
            NCT Recycling LLC · 6108 South College Ave STE C, Fort Collins CO 80525<br>
            <a href="mailto:info@nctrecycling.com" style="color:#999">info@nctrecycling.com</a>
          </p>
        </div>
      </div>
    `,
  });

  if (emailError) {
    console.error("Invite email error:", emailError);
    return NextResponse.json({ error: "Account created but invite email failed to send." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
