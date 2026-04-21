import { createClient } from "@/lib/supabase-server";
import { createCanonicalCoOpPickupRequest, getCanonicalCoOpRecentPickups, getCanonicalCoOpRequests, updateCanonicalCoOpRequestStatus } from "@/lib/co-op-canonical";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { NextResponse } from "next/server";

async function getNonprofitContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);
  if (profile?.role !== "nonprofit" || !profile?.application_id) return null;
  // Fetch capacity setting
  const { data: app } = await db
    .from("nonprofit_applications")
    .select("id, storage_capacity_bags")
    .eq("id", profile.application_id)
    .maybeSingle();
  return { nonprofit_id: profile.application_id, capacity: app?.storage_capacity_bags ?? 40 };
}

// GET — return pending request + cooldown warning + consecutive no-inventory warning
export async function GET() {
  const ctx = await getNonprofitContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const { nonprofit_id, capacity } = ctx;

  let effectiveRequests = [];
  let recentStops = [];

  try {
    const [canonicalRequests, canonicalRecentStops] = await Promise.all([
      getCanonicalCoOpRequests(db, nonprofit_id),
      getCanonicalCoOpRecentPickups(db, nonprofit_id, 2),
    ]);

    if (canonicalRequests !== null) {
      effectiveRequests = canonicalRequests || [];
    }

    if (canonicalRecentStops !== null) {
      recentStops = canonicalRecentStops || [];
    }
  } catch (canonicalError) {
    console.error("Canonical co-op pickup request load error:", canonicalError);
  }

  if (!effectiveRequests.length && !recentStops.length) {
    const [
      { data: requests },
      { data: legacyRecentStops },
    ] = await Promise.all([
      db.from("nonprofit_pickup_requests")
        .select("id, fill_level, estimated_bags, preferred_date, notes, status, created_at")
        .eq("nonprofit_id", nonprofit_id)
        .order("created_at", { ascending: false })
        .limit(6),
      db.from("pickup_route_stops")
        .select("no_inventory, completed_at")
        .eq("nonprofit_id", nonprofit_id)
        .eq("stop_status", "completed")
        .order("completed_at", { ascending: false })
        .limit(2),
    ]);

    effectiveRequests = requests || [];
    recentStops = legacyRecentStops || [];
  }

  const pending = effectiveRequests.find((r) => r.status === "pending") ?? null;
  const history = effectiveRequests.filter((r) => r.status !== "pending") ?? [];

  // 3-day soft cooldown: warn if last request was within 3 days
  const lastRequest = effectiveRequests[0];
  let cooldown_warning = false;
  let cooldown_days = 0;
  if (lastRequest && !pending) {
    const daysSince = (Date.now() - new Date(lastRequest.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 3) {
      cooldown_warning = true;
      cooldown_days = Math.ceil(3 - daysSince);
    }
  }

  // Consecutive no-inventory warning
  const consecutive_no_inventory = recentStops?.length === 2 && recentStops.every((s) => s.no_inventory);

  return NextResponse.json({ pending, history, cooldown_warning, cooldown_days, consecutive_no_inventory, capacity });
}

// POST — submit pickup request using fill_level
export async function POST(request) {
  const ctx = await getNonprofitContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const { nonprofit_id, capacity } = ctx;

  // Block if already has a pending request
  let checkedCanonicalPending = false;
  try {
    const canonicalRequests = await getCanonicalCoOpRequests(db, nonprofit_id, true);
    if (canonicalRequests !== null) {
      checkedCanonicalPending = true;
      const existingCanonical = canonicalRequests.find((request) => request.status === "pending");
      if (existingCanonical) {
        return NextResponse.json({ error: "You already have a pending pickup request." }, { status: 409 });
      }
    }
  } catch (canonicalError) {
    console.error("Canonical co-op pending pickup request check error:", canonicalError);
  }

  if (!checkedCanonicalPending) {
    const { data: existing } = await db
      .from("nonprofit_pickup_requests")
      .select("id")
      .eq("nonprofit_id", nonprofit_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "You already have a pending pickup request." }, { status: 409 });
    }
  }

  const { fill_level, preferred_date, notes } = await request.json();

  if (!fill_level || !["half", "full", "overflowing"].includes(fill_level)) {
    return NextResponse.json({ error: "Select a fill level (Half, Full, or Overflowing)." }, { status: 400 });
  }

  // Calculate estimated bags from fill_level + org capacity
  const estimateMap = {
    half: Math.round(capacity / 2),
    full: capacity,
    overflowing: Math.round(capacity * 1.5),
  };
  const estimated_bags = estimateMap[fill_level];

  const { error } = await db.from("nonprofit_pickup_requests").insert({
    nonprofit_id,
    fill_level,
    estimated_bags,
    preferred_date: preferred_date || null,
    notes: notes?.trim() || null,
  });

  if (error) {
    console.error("Pickup request insert error:", error);
    return NextResponse.json({ error: "Failed to submit request." }, { status: 500 });
  }

  try {
    await createCanonicalCoOpPickupRequest(db, nonprofit_id, { fill_level, estimated_bags, preferred_date, notes });
  } catch (canonicalError) {
    console.error("Canonical co-op pickup request sync error:", canonicalError);
  }

  return NextResponse.json({ success: true });
}

// PATCH — nonprofit cancels their pending request
export async function PATCH(request) {
  const ctx = await getNonprofitContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const db = createServiceClient();

  try {
    const canonicalRequests = await getCanonicalCoOpRequests(db, ctx.nonprofit_id);
    if (canonicalRequests !== null) {
      const request = canonicalRequests.find((entry) => entry.id === id);
      if (!request) {
        return NextResponse.json({ error: "Request not found." }, { status: 404 });
      }
      if (request.status !== "pending") {
        return NextResponse.json({ error: "Only pending requests can be cancelled." }, { status: 400 });
      }

      await updateCanonicalCoOpRequestStatus(db, ctx.nonprofit_id, "cancelled", id);
      await db
        .from("nonprofit_pickup_requests")
        .update({ status: "cancelled" })
        .eq("nonprofit_id", ctx.nonprofit_id)
        .eq("status", "pending");

      return NextResponse.json({ success: true });
    }
  } catch (canonicalError) {
    console.error("Canonical co-op pickup request cancel sync error:", canonicalError);
  }

  const { data: req } = await db
    .from("nonprofit_pickup_requests")
    .select("nonprofit_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!req || req.nonprofit_id !== ctx.nonprofit_id) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (req.status !== "pending") {
    return NextResponse.json({ error: "Only pending requests can be cancelled." }, { status: 400 });
  }

  await db.from("nonprofit_pickup_requests").update({ status: "cancelled" }).eq("id", id);
  try {
    await updateCanonicalCoOpRequestStatus(db, ctx.nonprofit_id, "cancelled");
  } catch (canonicalError) {
    console.error("Canonical co-op pickup request cancel sync error:", canonicalError);
  }
  return NextResponse.json({ success: true });
}
