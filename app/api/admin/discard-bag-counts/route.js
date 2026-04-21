import { createServiceClient } from "@/lib/supabase";
import { getCanonicalDiscardBagCount, markCanonicalDiscardPickupCollected } from "@/lib/discard-canonical";
import { NextResponse } from "next/server";

function checkAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

// GET — running bag total for an account
export async function GET(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const account_id = searchParams.get("account_id");
  if (!account_id) return NextResponse.json({ error: "Missing account_id." }, { status: 400 });

  const db = createServiceClient();
  try {
    const canonical = await getCanonicalDiscardBagCount(db, account_id, 20);
    if (canonical !== null) {
      return NextResponse.json({ total: canonical.total, entries: canonical.entries || [] });
    }
  } catch (canonicalError) {
    console.error("Canonical admin discard bag count load error:", canonicalError);
  }

  const { data: entries, error } = await db
    .from("discard_bag_counts")
    .select("id, bag_count, entry_type, notes, created_at")
    .eq("discard_account_id", account_id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  let total = 0;
  for (const entry of entries || []) {
    if (entry.entry_type === "pickup") break;
    total += entry.bag_count || 0;
  }

  return NextResponse.json({ total, entries: entries || [] });
}

// POST — admin marks bags as picked up (resets count)
export async function POST(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { account_id } = await request.json();
  if (!account_id) return NextResponse.json({ error: "Missing account_id." }, { status: 400 });

  const db = createServiceClient();
  const { error } = await db.from("discard_bag_counts").insert({
    discard_account_id: account_id,
    bag_count: 0,
    entry_type: "pickup",
  });

  if (error) return NextResponse.json({ error: "Failed." }, { status: 500 });
  try {
    await markCanonicalDiscardPickupCollected(db, account_id);
  } catch (canonicalError) {
    console.error("Canonical admin discard pickup mark error:", canonicalError);
  }
  return NextResponse.json({ success: true });
}
