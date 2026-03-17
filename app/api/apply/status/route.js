import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email required." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("reseller_applications")
    .select("id, status, full_name, business_name, program_type, created_at, reviewed_at, admin_notes")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "No application found for this email." }, { status: 404 });
  }

  return NextResponse.json({ application: data });
}
