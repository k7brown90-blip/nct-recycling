import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

async function getNonprofitId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const db = createServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("role, application_id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "nonprofit" || !profile?.application_id) return null;
  return profile.application_id;
}

// GET — return pending request (if any) + recent request history
export async function GET() {
  const nonprofit_id = await getNonprofitId();
  if (!nonprofit_id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const { data: requests, error } = await db
    .from("nonprofit_pickup_requests")
    .select("id, estimated_bags, estimated_weight_lbs, preferred_date, notes, status, created_at")
    .eq("nonprofit_id", nonprofit_id)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  const pending = requests?.find((r) => r.status === "pending") ?? null;
  const history = requests?.filter((r) => r.status !== "pending") ?? [];

  return NextResponse.json({ pending, history });
}

// POST — submit a new pickup request (one pending at a time)
export async function POST(request) {
  const nonprofit_id = await getNonprofitId();
  if (!nonprofit_id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();

  // Block if already has a pending request
  const { data: existing } = await db
    .from("nonprofit_pickup_requests")
    .select("id")
    .eq("nonprofit_id", nonprofit_id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "You already have a pending pickup request." }, { status: 409 });
  }

  const { estimated_bags, estimated_weight_lbs, preferred_date, notes } = await request.json();

  if (!estimated_bags && !estimated_weight_lbs) {
    return NextResponse.json({ error: "Provide at least an estimated bag count or weight." }, { status: 400 });
  }

  const { error } = await db.from("nonprofit_pickup_requests").insert({
    nonprofit_id,
    estimated_bags: estimated_bags ? parseInt(estimated_bags) : null,
    estimated_weight_lbs: estimated_weight_lbs ? parseFloat(estimated_weight_lbs) : null,
    preferred_date: preferred_date || null,
    notes: notes?.trim() || null,
  });

  if (error) {
    console.error("Pickup request insert error:", error);
    return NextResponse.json({ error: "Failed to submit request." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PATCH — nonprofit cancels their pending request
export async function PATCH(request) {
  const nonprofit_id = await getNonprofitId();
  if (!nonprofit_id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const db = createServiceClient();

  // Only allow cancelling their own pending request
  const { data: req } = await db
    .from("nonprofit_pickup_requests")
    .select("nonprofit_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!req || req.nonprofit_id !== nonprofit_id) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (req.status !== "pending") {
    return NextResponse.json({ error: "Only pending requests can be cancelled." }, { status: 400 });
  }

  await db.from("nonprofit_pickup_requests").update({ status: "cancelled" }).eq("id", id);
  return NextResponse.json({ success: true });
}
