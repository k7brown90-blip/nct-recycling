import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

// GET — all approved nonprofits with their latest bag count
export async function GET(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = createServiceClient();

  // Get all approved nonprofits
  const { data: nonprofits, error } = await db
    .from("nonprofit_applications")
    .select("id, org_name, contact_name, email, phone, address_street, address_city, address_state, available_pickup_hours, dock_instructions")
    .eq("status", "approved")
    .order("org_name");

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  // Get latest bag count for each nonprofit
  const ids = nonprofits.map((n) => n.id);
  const { data: bagCounts } = await db
    .from("bag_counts")
    .select("nonprofit_id, bag_count, notes, created_at")
    .in("nonprofit_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: false });

  // Map latest bag count per nonprofit
  const latestByNonprofit = {};
  for (const bc of bagCounts || []) {
    if (!latestByNonprofit[bc.nonprofit_id]) {
      latestByNonprofit[bc.nonprofit_id] = bc;
    }
  }

  const result = nonprofits.map((n) => ({
    ...n,
    bag_count: latestByNonprofit[n.id]?.bag_count ?? null,
    bag_count_updated: latestByNonprofit[n.id]?.created_at ?? null,
    bag_count_notes: latestByNonprofit[n.id]?.notes ?? null,
  }));

  return NextResponse.json({ nonprofits: result });
}
