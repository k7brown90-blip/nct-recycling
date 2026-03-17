import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

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

    // Check for duplicate email
    const { data: existing } = await supabase
      .from("reseller_applications")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "An application with this email already exists.", status: existing.status },
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

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    console.error("Apply route error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
