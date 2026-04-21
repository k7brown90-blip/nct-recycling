import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { addCanonicalCoOpBagCount, getCanonicalCoOpBagCount } from "@/lib/co-op-canonical";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { NextResponse } from "next/server";

async function getNonprofitId() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const db = createServiceClient();
  const profile = await getOrCreateProfile(user, db);
  if (profile?.role !== "nonprofit" || !profile?.application_id) return null;
  return profile.application_id;
}

// POST — nonprofit adds bags (additive — each entry is bags added, not the total)
export async function POST(request) {
  const nonprofit_id = await getNonprofitId();
  if (!nonprofit_id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { bag_count, notes } = await request.json();

  if (typeof bag_count !== "number" || bag_count < 1) {
    return NextResponse.json({ error: "Enter at least 1 bag." }, { status: 400 });
  }

  const db = createServiceClient();
  const { error } = await db.from("bag_counts").insert({
    nonprofit_id,
    bag_count,
    entry_type: "add",
    notes: notes?.trim() || null,
  });

  if (error) {
    console.error("Bag count insert error:", error);
    return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  }

  try {
    await addCanonicalCoOpBagCount(db, nonprofit_id, bag_count, notes);
  } catch (canonicalError) {
    console.error("Canonical co-op bag count sync error:", canonicalError);
  }

  return NextResponse.json({ success: true });
}

// GET — return running total since last pickup + full history
export async function GET() {
  const nonprofit_id = await getNonprofitId();
  if (!nonprofit_id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  try {
    const canonicalSnapshot = await getCanonicalCoOpBagCount(db, nonprofit_id);
    if (canonicalSnapshot !== null) {
      return NextResponse.json(canonicalSnapshot);
    }
  } catch (canonicalError) {
    console.error("Canonical co-op bag count load error:", canonicalError);
  }

  const { data: entries, error } = await db
    .from("bag_counts")
    .select("id, bag_count, entry_type, notes, created_at")
    .eq("nonprofit_id", nonprofit_id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  // Running total = sum of 'add' entries since the most recent 'pickup' entry
  let total = 0;
  const sinceLastPickup = [];
  for (const entry of entries || []) {
    if (entry.entry_type === "pickup") break; // stop summing at last collection
    total += entry.bag_count || 0;
    sinceLastPickup.push(entry);
  }

  return NextResponse.json({ total, sinceLastPickup, allEntries: entries || [] });
}
