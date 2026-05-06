import { createServiceClient } from "@/lib/supabase";
import { getActiveAgreement } from "@/lib/agreement-templates";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const formData = await request.formData();

    const full_name = formData.get("full_name")?.trim();
    const email = formData.get("email")?.trim().toLowerCase();
    const phone = formData.get("phone")?.trim() || null;
    const business_name = formData.get("business_name")?.trim() || null;
    const platforms = formData.getAll("platforms");
    const website = formData.get("website")?.trim() || null;
    const visit_frequency = formData.get("visit_frequency") || null;
    const expected_spend = formData.get("expected_spend") || null;
    const categories = formData.getAll("categories");
    const shop_name_to_feature = formData.get("shop_name_to_feature")?.trim() || null;
    const feature_consent = formData.get("feature_consent") === "true";

    const wants_warehouse_access = formData.get("wants_warehouse_access") === "yes";
    const contract_agreed = formData.get("contract_agreed") === "true";
    const contract_signed_name = formData.get("contract_signed_name")?.trim() || null;

    if (!full_name || !email) {
      return NextResponse.json({ error: "Full name and email are required." }, { status: 400 });
    }

    if (wants_warehouse_access && (!contract_agreed || !contract_signed_name)) {
      return NextResponse.json(
        { error: "Warehouse access requires the signed Reseller Buyer Agreement." },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // Duplicate email check across reseller + nonprofit applications.
    const [{ data: existingReseller }, { data: existingNonprofit }] = await Promise.all([
      supabase.from("reseller_applications").select("id").eq("email", email).maybeSingle(),
      supabase.from("nonprofit_applications").select("id").eq("email", email).maybeSingle(),
    ]);

    if (existingReseller || existingNonprofit) {
      return NextResponse.json(
        { error: "An application with this email already exists." },
        { status: 409 },
      );
    }

    // Stamp the active reseller agreement only when warehouse access is requested.
    let agreement_template_id = null;
    let agreement_version = null;
    if (wants_warehouse_access) {
      const tmpl = await getActiveAgreement("reseller");
      agreement_template_id = tmpl?.id || null;
      agreement_version = tmpl?.version_label || "buyer_v1";
    }

    const status = wants_warehouse_access ? "pending" : "approved";

    const insertPayload = {
      full_name,
      email,
      phone,
      business_name,
      platforms,
      website,
      visit_frequency,
      expected_spend,
      categories,
      shop_name_to_feature,
      feature_consent,
      wants_warehouse_access,
      tier: "public",
      agreement_template_id,
      agreement_version,
      contract_agreed: wants_warehouse_access ? contract_agreed : false,
      contract_agreed_at: wants_warehouse_access ? new Date().toISOString() : null,
      contract_signed_name: wants_warehouse_access ? contract_signed_name : null,
      status,
      reviewed_at: wants_warehouse_access ? null : new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("reseller_applications")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      console.error("Insert error:", error);
      return NextResponse.json({ error: "Failed to submit application." }, { status: 500 });
    }

    const subjectPrefix = wants_warehouse_access
      ? "New Warehouse Access Application"
      : "New Online Buyer Auto-Approved";

    resend.emails.send({
      from: "NCT Recycling Portal <donate@nctrecycling.com>",
      to: "donate@nctrecycling.com",
      subject: `${subjectPrefix} — ${full_name}${business_name ? ` (${business_name})` : ""}`,
      html: `
        <h2>${subjectPrefix}</h2>
        <table style="border-collapse:collapse;width:100%;max-width:600px">
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Name</td><td style="padding:6px 12px">${full_name}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Business</td><td style="padding:6px 12px">${business_name || "—"}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Email</td><td style="padding:6px 12px">${email}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Phone</td><td style="padding:6px 12px">${phone || "—"}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Warehouse Access</td><td style="padding:6px 12px">${wants_warehouse_access ? "Requested (pending review)" : "No (online only — auto-approved)"}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Tier</td><td style="padding:6px 12px">public</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Platforms</td><td style="padding:6px 12px">${platforms?.join(", ") || "—"}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Visit Frequency</td><td style="padding:6px 12px">${visit_frequency || "—"}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Expected Spend</td><td style="padding:6px 12px">${expected_spend || "—"}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Categories</td><td style="padding:6px 12px">${categories?.join(", ") || "—"}</td></tr>
          ${wants_warehouse_access ? `
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Agreement</td><td style="padding:6px 12px">${agreement_version || "—"}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold;background:#f5f5f5">Signed As</td><td style="padding:6px 12px">${contract_signed_name}</td></tr>
          ` : ""}
        </table>
        <p style="margin-top:20px">
          <a href="https://www.nctrecycling.com/admin" style="background:#0b2a45;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:bold">
            Review in Admin Dashboard →
          </a>
        </p>
      `,
    }).catch((err) => console.error("Email send error:", err));

    return NextResponse.json({ success: true, id: data.id, status });
  } catch (err) {
    console.error("Apply route error:", err);
    return NextResponse.json({ error: "Server error." }, { status: 500 });
  }
}
