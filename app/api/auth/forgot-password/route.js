import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { buildActivateUrl } from "@/lib/auth-confirm-url";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: "Email required." }, { status: 400 });

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`;

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  // Always return success — don't reveal whether an account exists
  if (error || !data?.properties?.hashed_token) {
    return NextResponse.json({ success: true });
  }

  // Route through our activate page so email scanners can't consume the token
  const activateUrl = buildActivateUrl(data.properties, {
    next: "/auth/update-password",
  });

  await resend.emails.send({
    from: "NCT Recycling <noreply@nctrecycling.com>",
    to: email,
    subject: "Reset your NCT Recycling password",
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
        <div style="background:#0b2a45;padding:24px 32px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:22px">NCT Recycling</h1>
          <p style="color:#d49a22;margin:4px 0 0;font-size:13px;letter-spacing:1px;text-transform:uppercase">Fort Collins, CO</p>
        </div>
        <div style="background:#f9f9f9;padding:32px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px">
          <p style="font-size:15px;margin:0 0 20px">
            We received a request to reset the password for your NCT Recycling partner account.
            Click the button below to set a new password.
          </p>
          <p style="text-align:center;margin:28px 0">
            <a href="${activateUrl}"
               style="background:#0b2a45;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;display:inline-block">
              Reset My Password →
            </a>
          </p>
          <p style="font-size:13px;color:#666;margin:20px 0 0">
            This link expires in 24 hours. If you didn't request this, you can safely ignore this email.
          </p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />
          <p style="font-size:12px;color:#999;margin:0">
            NCT Recycling LLC · 6108 South College Ave STE C, Fort Collins CO 80525<br>
            <a href="mailto:donate@nctrecycling.com" style="color:#999">donate@nctrecycling.com</a>
          </p>
        </div>
      </div>
    `,
  }).catch((err) => console.error("Password reset email error:", err));

  return NextResponse.json({ success: true });
}
