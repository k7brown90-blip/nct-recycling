import { createServiceClient } from "@/lib/supabase";
import { addCanonicalCoOpBagCount, getCanonicalCoOpBagLevels } from "@/lib/co-op-canonical";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

// GET — all approved nonprofits with running bag total since last pickup + any pending pickup request
export async function GET(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = createServiceClient();

  const { data: nonprofits, error } = await db
    .from("nonprofit_applications")
    .select("id, org_name, contact_name, email, phone, address_street, address_city, address_state, available_pickup_hours, dock_instructions, account_type, estimated_bags")
    .eq("status", "approved")
    .order("org_name");

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  const ids = nonprofits.map((n) => n.id);
  const placeholder = ["00000000-0000-0000-0000-000000000000"];

  // Bag counts and pending pickup requests in parallel
  const [{ data: bagCounts }, { data: pickupRequests }] = await Promise.all([
    db
      .from("bag_counts")
      .select("nonprofit_id, bag_count, entry_type, notes, created_at")
      .in("nonprofit_id", ids.length ? ids : placeholder)
      .order("created_at", { ascending: false }),
    db
      .from("nonprofit_pickup_requests")
      .select("id, nonprofit_id, estimated_bags, estimated_weight_lbs, preferred_date, notes, created_at")
      .in("nonprofit_id", ids.length ? ids : placeholder)
      .eq("status", "pending"),
  ]);

  // Group bag counts by nonprofit
  const entriesByNp = {};
  for (const bc of bagCounts || []) {
    if (!entriesByNp[bc.nonprofit_id]) entriesByNp[bc.nonprofit_id] = [];
    entriesByNp[bc.nonprofit_id].push(bc);
  }

  // Index pending requests by nonprofit_id (one per nonprofit)
  const requestByNp = {};
  for (const r of pickupRequests || []) {
    requestByNp[r.nonprofit_id] = r;
  }

  const result = nonprofits.map((n) => {
    const entries = entriesByNp[n.id] || [];
    let total = 0;
    let lastUpdated = null;
    let lastEntryType = null;
    for (const entry of entries) {
      if (entry.entry_type === "pickup") break;
      total += entry.bag_count || 0;
      if (!lastUpdated) { lastUpdated = entry.created_at; lastEntryType = entry.entry_type; }
    }
    return {
      ...n,
      bag_count: entries.length > 0 ? total : null,
      bag_count_updated: lastUpdated,
      bag_count_is_admin: lastEntryType === "admin_override",
      pending_request: requestByNp[n.id] ?? null,
    };
  });

  try {
    const canonicalLevels = await getCanonicalCoOpBagLevels(db, ids);
    if (canonicalLevels) {
      return NextResponse.json({
        nonprofits: result.map((nonprofit) => {
          if (!canonicalLevels.has(nonprofit.id)) return nonprofit;

          const canonical = canonicalLevels.get(nonprofit.id) || {};
          return {
            ...nonprofit,
            bag_count: canonical.bag_count ?? nonprofit.bag_count ?? null,
            bag_count_updated: canonical.bag_count_updated || nonprofit.bag_count_updated || null,
            bag_count_is_admin: canonical.bag_count_is_admin ?? nonprofit.bag_count_is_admin ?? false,
            pending_request: canonical.pending_request ?? null,
          };
        }),
      });
    }
  } catch (canonicalError) {
    console.error("Canonical co-op bag levels load error:", canonicalError);
  }

  return NextResponse.json({ nonprofits: result });
}

// PATCH — admin manually sets a bag count for a nonprofit (admin_override entry)
export async function PATCH(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { nonprofit_id, bag_count } = await request.json();
  if (!nonprofit_id || bag_count == null) {
    return NextResponse.json({ error: "Missing nonprofit_id or bag_count." }, { status: 400 });
  }

  const count = parseInt(bag_count);
  if (isNaN(count) || count < 0) {
    return NextResponse.json({ error: "Invalid bag count." }, { status: 400 });
  }

  const db = createServiceClient();
  const { error } = await db.from("bag_counts").insert({
    nonprofit_id,
    bag_count: count,
    entry_type: "admin_override",
    notes: `Admin override — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
  });

  if (error) {
    console.error("Admin bag count override error:", error);
    return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  }

  try {
    await addCanonicalCoOpBagCount(db, nonprofit_id, count, `Admin override - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`, "adjustment");
  } catch (canonicalError) {
    console.error("Canonical co-op admin override sync error:", canonicalError);
  }

  return NextResponse.json({ success: true });
}
