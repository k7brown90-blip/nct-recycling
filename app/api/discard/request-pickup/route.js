import { createClient } from "@/lib/supabase-server";
import { createCanonicalDiscardPickupRequest, getCanonicalDiscardRequests } from "@/lib/discard-canonical";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { NextResponse } from "next/server";

async function getDiscardAccountId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);
  if (profile?.role !== "discard" || !profile?.discard_account_id) return null;
  return profile.discard_account_id;
}

export async function GET() {
  const discard_account_id = await getDiscardAccountId();
  if (!discard_account_id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  try {
    const canonical = await getCanonicalDiscardRequests(db, discard_account_id);
    if (canonical !== null) {
      return NextResponse.json({ requests: canonical || [] });
    }
  } catch (canonicalError) {
    console.error("Canonical discard pickup request load error:", canonicalError);
  }

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
  const requestPayload = {
    discard_account_id,
    preferred_date: preferred_date || null,
    estimated_weight_lbs: estimated_weight_lbs ? parseInt(estimated_weight_lbs) : null,
    estimated_bags: estimated_bags ? parseInt(estimated_bags) : null,
    notes: notes?.trim() || null,
    status: "pending",
  };

  const { data: insertedRequest, error } = await db
    .from("discard_pickup_requests")
    .insert(requestPayload)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: "Failed to submit." }, { status: 500 });

  try {
    await createCanonicalDiscardPickupRequest(db, insertedRequest.id, discard_account_id, requestPayload);
  } catch (canonicalError) {
    console.error("Canonical discard pickup request sync error:", canonicalError);
  }

  return NextResponse.json({ success: true });
}
