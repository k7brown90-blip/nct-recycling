import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

export async function POST(request) {
  if (!checkAdminAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { discard_account_id, email, contact_name, org_name } = await request.json();
  if (!discard_account_id || !email) {
    return NextResponse.json({ error: "Missing discard_account_id and email." }, { status: 400 });
  }

  const db = createServiceClient();

  // Generate a short-lived invite token (7 days) — this is what goes in the email URL,
  // NOT the one-time Supabase auth link. A fresh Supabase link is generated on-demand
  // when the user actually clicks the button, so email scanners can't consume it.
  const inviteToken = randomUUID();
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: tokenError } = await db
    .from("discard_accounts")
    .update({ invite_token: inviteToken, invite_expires_at: inviteExpiresAt })
    .eq("id", discard_account_id);

  if (tokenError) {
    console.error("Failed to store invite token:", tokenError);
    return NextResponse.json({ error: "Failed to generate invite." }, { status: 500 });
  }

  // The activate URL contains only the short token — no Supabase auth link is embedded.
  // A fresh auth link is generated server-side when the user clicks the button.
  const activateUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/activate?discard_token=${inviteToken}`;
  const greeting = contact_name ? `Hi ${contact_name},` : "Hi,";

  const { error: emailError } = await resend.emails.send({
    from: "NCT Recycling <noreply@nctrecycling.com>",
    to: email,
    subject: "Your NCT Recycling partner account is ready",
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
        <div style="background:#0b2a45;padding:24px 32px;border-radius:8px 8px 0 0">
          <h1 style="color:white;margin:0;font-size:22px">NCT Recycling</h1>
          <p style="color:#d49a22;margin:4px 0 0;font-size:13px;letter-spacing:1px;text-transform:uppercase">Fort Collins, CO</p>
        </div>
        <div style="background:#f9f9f9;padding:32px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px">
          <p style="font-size:16px;margin:0 0 12px">${greeting}</p>
          <p style="font-size:15px;margin:0 0 20px">
            Your NCT Recycling partner account for <strong>${org_name || "your organization"}</strong> is ready.
            Click the button below to review and accept your discard purchase agreement, then set your password and access your partner portal.
          </p>
          <p style="text-align:center;margin:28px 0">
            <a href="${activateUrl}"
               style="background:#d49a22;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;display:inline-block">
              Set Password &amp; Access Portal →
            </a>
          </p>
          <p style="font-size:13px;color:#666;margin:20px 0 0">
            This link expires in 7 days. Agreement acceptance is required before portal access is activated. Questions? Call us at (970) 232-9108.
          </p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />
          <p style="font-size:12px;color:#999;margin:0">
            NCT Recycling LLC · 6108 South College Ave STE C, Fort Collins CO 80525<br>
            <a href="mailto:donate@nctrecycling.com" style="color:#999">donate@nctrecycling.com</a>
          </p>
        </div>
      </div>
    `,
  });

  if (emailError) return NextResponse.json({ error: "Invite token saved but email failed to send." }, { status: 500 });
  return NextResponse.json({ success: true });
}
