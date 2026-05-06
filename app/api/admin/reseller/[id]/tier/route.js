import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.ADMIN_SECRET}`;
  return auth === expected;
}

const VALID_TIERS = ["public", "employee"];

export async function PATCH(request, { params }) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing reseller id." }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const tier = body?.tier;
  if (!VALID_TIERS.includes(tier)) {
    return NextResponse.json(
      { error: `Tier must be one of: ${VALID_TIERS.join(", ")}.` },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  const { data: existing, error: lookupError } = await supabase
    .from("reseller_applications")
    .select("id, tier")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "Lookup failed." }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Reseller application not found." }, { status: 404 });
  }

  if (existing.tier === tier) {
    return NextResponse.json({ success: true, tier, unchanged: true });
  }

  const { error } = await supabase
    .from("reseller_applications")
    .update({ tier })
    .eq("id", id);

  if (error) {
    console.error("Reseller tier update error:", error);
    return NextResponse.json({ error: "Failed to update tier." }, { status: 500 });
  }

  return NextResponse.json({ success: true, tier });
}
