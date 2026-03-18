import { createServiceClient } from "@/lib/supabase";
import { generateAgreementPDF } from "@/lib/generate-agreement-pdf";
import { NextResponse } from "next/server";

function checkAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

// GET — return signed URL if PDF exists, or { missing: true } if it doesn't
export async function GET(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const application_id = searchParams.get("application_id");
  if (!application_id) return NextResponse.json({ error: "Missing application_id." }, { status: 400 });

  const db = createServiceClient();

  // Check if the file actually exists before creating a signed URL
  const { data: files } = await db.storage
    .from("nonprofit-docs")
    .list("agreements", { search: `${application_id}.pdf` });

  const exists = files?.some((f) => f.name === `${application_id}.pdf`);
  if (!exists) return NextResponse.json({ missing: true });

  const { data: signedUrl, error } = await db.storage
    .from("nonprofit-docs")
    .createSignedUrl(`agreements/${application_id}.pdf`, 300);

  if (error || !signedUrl) return NextResponse.json({ missing: true });

  return NextResponse.json({ url: signedUrl.signedUrl });
}

// POST — regenerate and store the agreement PDF for an existing application
export async function POST(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { application_id } = await request.json();
  if (!application_id) return NextResponse.json({ error: "Missing application_id." }, { status: 400 });

  const db = createServiceClient();
  const { data: app, error: appError } = await db
    .from("nonprofit_applications")
    .select("org_name, contact_name, authorized_title, contract_signed_name, contract_agreed_at, ein, email")
    .eq("id", application_id)
    .single();

  if (appError || !app) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  try {
    const pdfBytes = await generateAgreementPDF({
      org_name: app.org_name,
      contact_name: app.contact_name,
      authorized_title: app.authorized_title,
      contract_signed_name: app.contract_signed_name,
      contract_agreed_at: app.contract_agreed_at || new Date().toISOString(),
      ein: app.ein,
      email: app.email,
      application_id,
    });

    const { error: uploadError } = await db.storage
      .from("nonprofit-docs")
      .upload(`agreements/${application_id}.pdf`, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: signedUrl } = await db.storage
      .from("nonprofit-docs")
      .createSignedUrl(`agreements/${application_id}.pdf`, 300);

    return NextResponse.json({ url: signedUrl?.signedUrl });
  } catch (err) {
    console.error("PDF regeneration error:", err);
    return NextResponse.json({ error: "Failed to generate PDF." }, { status: 500 });
  }
}
