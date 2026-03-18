import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

// GET — all approved nonprofits with running bag total since last pickup
export async function GET(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = createServiceClient();

  const { data: nonprofits, error } = await db
    .from("nonprofit_applications")
    .select("id, org_name, contact_name, email, phone, address_street, address_city, address_state, available_pickup_hours, dock_instructions, account_type")
    .eq("status", "approved")
    .order("org_name");

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  const ids = nonprofits.map((n) => n.id);
  const { data: bagCounts } = await db
    .from("bag_counts")
    .select("nonprofit_id, bag_count, entry_type, notes, created_at")
    .in("nonprofit_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false });

  // For each nonprofit: sum 'add' entries since the most recent 'pickup' entry
  const entriesByNp = {};
  for (const bc of bagCounts || []) {
    if (!entriesByNp[bc.nonprofit_id]) entriesByNp[bc.nonprofit_id] = [];
    entriesByNp[bc.nonprofit_id].push(bc);
  }

  const result = nonprofits.map((n) => {
    const entries = entriesByNp[n.id] || [];
    let total = 0;
    let lastUpdated = null;
    for (const entry of entries) {
      if (entry.entry_type === "pickup") break;
      total += entry.bag_count || 0;
      if (!lastUpdated) lastUpdated = entry.created_at;
    }
    return {
      ...n,
      bag_count: entries.length > 0 ? total : null,
      bag_count_updated: lastUpdated,
    };
  });

  return NextResponse.json({ nonprofits: result });
}
