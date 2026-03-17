import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const formData = await request.formData();

    const full_name = formData.get("full_name")?.trim();
    const email = formData.get("email")?.trim().toLowerCase();
    const phone = formData.get("phone")?.trim();
    const business_name = formData.get("business_name")?.trim();
    const platforms = formData.getAll("platforms");
    const website = formData.get("website")?.trim();
    const visit_frequency = formData.get("visit_frequency");
    const expected_spend = formData.get("expected_spend");
    const categories = formData.getAll("categories");
    const program_type = formData.get("program_type");
    const tax_license_number = formData.get("tax_license_number")?.trim();
    const estimated_monthly_volume = formData.get("estimated_monthly_volume")?.trim();
    const business_type = formData.get("business_type");
    const shop_name_to_feature = formData.get("shop_name_to_feature")?.trim();
    const feature_consent = formData.get("feature_consent") === "true";
    const contract_agreed = formData.get("contract_agreed") === "true";
    const contract_signed_name = formData.get("contract_signed_name")?.trim();
    const dr0563_file = formData.get("dr0563_file");

    // Validate required fields
    if (!full_name || !email || !contract_agreed || !contract_signed_name) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (!["reseller", "wholesale", "both"].includes(program_type)) {
      return NextResponse.json({ error: "Invalid program type." }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check for duplicate email across both application types
    const [{ data: existingReseller }, { data: existingNonprofit }] = await Promise.all([
      supabase.from("reseller_applications").select("id").eq("email", email).maybeSingle(),
      supabase.from("nonprofit_applications").select("id").eq("email", email).maybeSingle(),
    ]);

    if (existingReseller || existingNonprofit) {
      return NextResponse.json(
        { error: "An application with this email already exists." },
        { status: 409 }
      );
    }

    // Upload DR 0563 if provided
    let dr0563_file_url = null;
    if (dr0563_file && dr0563_file.size > 0) {
      const ext = dr0563_file.name.split(".").pop();
      const fileName = `${Date.now()}_${email.replace(/[^a-z0-9]/g, "_")}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("dr0563")
        .upload(fileName, dr0563_file, { contentType: dr0563_file.type });

      if (uploadError) {
        console.error("DR 0563 upload error:", uploadError);
        // Don't block the application — admin can follow up
      } else {
        dr0563_file_url = fileName;
      }
    }

    const { data, error } = await supabase
      .from("reseller_applications")
      .insert({
        full_name,
        email,
        phone,
        business_name,
        platforms,
        website,
        visit_frequency,
        expected_spend,
        categories,
        program_type,
        tax_license_number,
        estimated_monthly_volume,
        business_type,
        shop_name_to_feature,
        feature_consent,
        contract_agreed,
        contract_agreed_at: new Date().toISOString(),
        contract_signed_name,
        dr0563_file_url,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json({ error: "Failed to submit application." }, { status: 500 });
    }

    // Send notification email to NCT Recycling
    resend.emails.send({
      from: "NCT Recycling Portal <noreply@nctrecycling.com>",
      to: "donate@nctrecycling.com",
      subject: `New Partner Application — ${full_name}${business_name ? ` (${business_name})` : ""}`,
      html: `
        <h2>New Partner Application Received</h2>
        <table style="border-collapse:collapse;width:100%;max-width:600px">
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Name</td><td style="padding:6px 12px">${full_name}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Business</td><td style="padding:6px 12px">${business_name || "—"}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Email</td><td style="padding:6px 12px">${email}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Phone</td><td style="padding:6px 12px">${phone || "—"}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Program</td><td style="padding:6px 12px">${program_type}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Platforms</td><td style="padding:6px 12px">${platforms?.join(", ") || "—"}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Visit Frequency</td><td style="padding:6px 12px">${visit_frequency || "—"}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Expected Spend</td><td style="padding:6px 12px">${expected_spend || "—"}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Categories</td><td style="padding:6px 12px">${categories?.join(", ") || "—"}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Tax License #</td><td style="padding:6px 12px">${tax_license_number || "—"}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">DR 0563</td><td style="padding:6px 12px">${dr0563_file_url ? "✅ Uploaded" : "Not provided"}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Signed As</td><td style="padding:6px 12px">${contract_signed_name}</td></tr>
        </table>
        <p style="margin-top:20px">
          <a href="https://www.nctrecycling.com/admin" style="background:#0b2a45;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:bold">
            Review in Admin Dashboard →
          </a>
        </p>
      `,
    }).catch((err) => console.error("Email send error:", err));

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    console.error("Apply route error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
