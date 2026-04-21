import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

async function getApprovedUsers(db, recipientType) {
  const users = [];

  if (recipientType === "all" || recipientType === "nonprofit") {
    const { data } = await db
      .from("nonprofit_applications")
      .select("email, org_name")
      .eq("status", "approved");
    if (data) {
      data.forEach((r) => users.push({ email: r.email, name: r.org_name, role: "nonprofit" }));
    }
  }

  if (recipientType === "all" || recipientType === "reseller") {
    const { data } = await db
      .from("reseller_applications")
      .select("email, full_name")
      .eq("status", "approved");
    if (data) {
      data.forEach((r) => users.push({ email: r.email, name: r.full_name, role: "reseller" }));
    }
  }

  return users;
}

function buildEmailHtml(name, subject, body) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const bodyHtml = body
    .split("\n")
    .map((line) => line.trim() === "" ? "<br />" : `<p style="font-size:15px;margin:0 0 12px">${line}</p>`)
    .join("");

  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
      <div style="background:#0b2a45;padding:24px 32px;border-radius:8px 8px 0 0">
        <h1 style="color:white;margin:0;font-size:22px">NCT Recycling</h1>
        <p style="color:#d49a22;margin:4px 0 0;font-size:13px;letter-spacing:1px;text-transform:uppercase">Fort Collins, CO</p>
      </div>
      <div style="background:#f9f9f9;padding:32px;border:1px solid #e5e5e5;border-top:none;border-radius:0 0 8px 8px">
        <p style="font-size:16px;margin:0 0 16px">${greeting}</p>
        ${bodyHtml}
        <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />
        <p style="font-size:12px;color:#999;margin:0">
          NCT Recycling LLC · 6108 South College Ave STE C, Fort Collins CO 80525<br>
          <a href="mailto:donate@nctrecycling.com" style="color:#999">donate@nctrecycling.com</a> · (970) 232-9108
        </p>
        <p style="font-size:11px;color:#bbb;margin:8px 0 0">
          This is a notification from NCT Recycling. Please do not reply to this email.
        </p>
      </div>
    </div>
  `;
}

// GET — return list of all approved portal users
export async function GET(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = createServiceClient();
  const users = await getApprovedUsers(db, "all");
  return NextResponse.json({ users });
}

// POST — send email(s) to portal users
export async function POST(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { recipient_type, to_email, to_name, subject, body } = await request.json();

  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "Subject and body are required." }, { status: 400 });
  }

  let recipients = [];

  if (recipient_type === "individual") {
    if (!to_email?.trim()) {
      return NextResponse.json({ error: "Email address is required for individual send." }, { status: 400 });
    }
    recipients = [{ email: to_email.trim(), name: to_name?.trim() || "" }];
  } else {
    const db = createServiceClient();
    recipients = await getApprovedUsers(db, recipient_type);
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients found." }, { status: 400 });
  }

  let sent = 0;
  const errors = [];

  for (const recipient of recipients) {
    const { error } = await resend.emails.send({
      from: "NCT Recycling <noreply@nctrecycling.com>",
      to: recipient.email,
      subject,
      html: buildEmailHtml(recipient.name, subject, body),
    });
    if (error) {
      errors.push({ email: recipient.email, error: error.message });
    } else {
      sent++;
    }
  }

  if (errors.length > 0) {
    console.error("Email send errors:", errors);
  }

  return NextResponse.json({ success: true, sent, failed: errors.length });
}
