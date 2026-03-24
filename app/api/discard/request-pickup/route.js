import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

async function getDiscardAccountId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const db = createServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("role, discard_account_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "discard" || !profile?.discard_account_id) return null;
  return profile.discard_account_id;
}

export async function GET() {
  const discard_account_id = await getDiscardAccountId();
  if (!discard_account_id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const { data, error } = await db
    .from("discard_pickup_requests")
    .select("*")
    .eq("discard_account_id", discard_account_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });
  return NextResponse.json({ requests: data || [] });
}

export async function POST(request) {
  const discard_account_id = await getDiscardAccountId();
  if (!discard_account_id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json();
  const { preferred_date, estimated_weight_lbs, estimated_bags, notes } = body;

  const db = createServiceClient();
  const { error } = await db.from("discard_pickup_requests").insert({
    discard_account_id,
    preferred_date: preferred_date || null,
    estimated_weight_lbs: estimated_weight_lbs ? parseInt(estimated_weight_lbs) : null,
    estimated_bags: estimated_bags ? parseInt(estimated_bags) : null,
    notes: notes?.trim() || null,
    status: "pending",
  });

  if (error) return NextResponse.json({ error: "Failed to submit." }, { status: 500 });
  return NextResponse.json({ success: true });
}
