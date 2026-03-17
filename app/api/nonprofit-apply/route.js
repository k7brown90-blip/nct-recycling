import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const formData = await request.formData();

    const org_name = formData.get("org_name")?.trim();
    const org_type = formData.get("org_type");
    const ein = formData.get("ein")?.trim();
    const contact_name = formData.get("contact_name")?.trim();
    const contact_title = formData.get("contact_title")?.trim();
    const email = formData.get("email")?.trim().toLowerCase();
    const phone = formData.get("phone")?.trim();
    const website = formData.get("website")?.trim();
    const address_street = formData.get("address_street")?.trim();
    const address_city = formData.get("address_city")?.trim();
    const address_state = formData.get("address_state")?.trim();
    const address_zip = formData.get("address_zip")?.trim();
    const pickup_address = formData.get("pickup_address")?.trim();
    const dock_instructions = formData.get("dock_instructions")?.trim();
    const available_pickup_hours = formData.get("available_pickup_hours")?.trim();
    const pickup_notes = formData.get("pickup_notes")?.trim();
    const estimated_donation_lbs = formData.get("estimated_donation_lbs")?.trim();
    const categories_needed = formData.getAll("categories_needed");
    const feature_consent = formData.get("feature_consent") === "true";
    const contract_agreed = formData.get("contract_agreed") === "true";
    const contract_signed_name = formData.get("contract_signed_name")?.trim();
    const authorized_title = formData.get("authorized_title")?.trim();
    const irs_letter = formData.get("irs_letter");

    if (!org_name || !contact_name || !email || !contract_agreed || !contract_signed_name || !authorized_title) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Check for duplicate email across both application types
    const [{ data: existingNonprofit }, { data: existingReseller }] = await Promise.all([
      supabase.from("nonprofit_applications").select("id").eq("email", email).maybeSingle(),
      supabase.from("reseller_applications").select("id").eq("email", email).maybeSingle(),
    ]);

    if (existingNonprofit || existingReseller) {
      return NextResponse.json(
        { error: "An application with this email already exists." },
        { status: 409 }
      );
    }

    // Upload IRS letter if provided
    let irs_letter_url = null;
    if (irs_letter && irs_letter.size > 0) {
      const ext = irs_letter.name.split(".").pop();
      const fileName = `${Date.now()}_${email.replace(/[^a-z0-9]/g, "_")}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("nonprofit-docs")
        .upload(`irs-letters/${fileName}`, irs_letter, { contentType: irs_letter.type });

      if (!uploadError) irs_letter_url = `irs-letters/${fileName}`;
    }

    const { data, error } = await supabase
      .from("nonprofit_applications")
      .insert({
        org_name, org_type, ein,
        contact_name, contact_title, email, phone, website,
        address_street, address_city, address_state, address_zip,
        pickup_address, dock_instructions, available_pickup_hours, pickup_notes,
        estimated_donation_lbs,
        categories_needed: categories_needed.length ? categories_needed : null,
        feature_consent, contract_agreed,
        contract_agreed_at: new Date().toISOString(),
        contract_signed_name, authorized_title,
        irs_letter_url, status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Nonprofit insert error:", error);
      return NextResponse.json({ error: "Failed to submit application." }, { status: 500 });
    }

    // Notify NCT Recycling
    resend.emails.send({
      from: "NCT Recycling Portal <donate@nctrecycling.com>",
      to: "donate@nctrecycling.com",
      subject: `New Nonprofit Co-Op Application — ${org_name}`,
      html: `
        <h2>New Nonprofit Co-Op Application</h2>
        <table style="border-collapse:collapse;width:100%;max-width:600px">
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Organization</td><td style="padding:6px 12px">${org_name}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Contact</td><td style="padding:6px 12px">${contact_name}${contact_title ? `, ${contact_title}` : ""}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Email</td><td style="padding:6px 12px">${email}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Phone</td><td style="padding:6px 12px">${phone || "—"}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">EIN</td><td style="padding:6px 12px">${ein || "—"}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Est. Monthly Donations</td><td style="padding:6px 12px">${estimated_donation_lbs || "—"}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">IRS Letter</td><td style="padding:6px 12px">${irs_letter_url ? "✅ Uploaded" : "Not provided"}</td></tr>
        </table>
        <p style="margin-top:20px">
          <a href="https://www.nctrecycling.com/admin" style="background:#0b2a45;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:bold">
            Review in Admin Dashboard →
          </a>
        </p>
      `,
    }).catch((err) => console.error("Email error:", err));

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    console.error("Nonprofit apply error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
