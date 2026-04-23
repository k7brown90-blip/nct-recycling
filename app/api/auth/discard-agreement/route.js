import { createServiceClient } from "@/lib/supabase";
import { buildDiscardAgreementText } from "@/lib/discard-agreement";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const discardToken = searchParams.get("discard_token");

  if (!discardToken) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: account, error } = await db
    .from("discard_accounts")
    .select("id, org_name, address_street, address_city, address_state, address_zip, contact_name, contact_email, contact_phone, pickup_frequency, rate_per_1000_lbs, flat_rate_per_pickup, min_lbs_weekly, min_lbs_biweekly, min_lbs_adhoc, projected_lbs_week")
    .eq("invite_token", discardToken)
    .gt("invite_expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !account) {
    return NextResponse.json({ error: "This agreement link has expired or is invalid." }, { status: 404 });
  }

  return NextResponse.json({
    organization_name: account.org_name,
    contact_name: account.contact_name || "",
    contact_email: account.contact_email || "",
    agreement_text: buildDiscardAgreementText(account),
  });
}