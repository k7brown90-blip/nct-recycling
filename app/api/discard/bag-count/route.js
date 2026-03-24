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

export async function POST(request) {
  const discard_account_id = await getDiscardAccountId();
  if (!discard_account_id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { bag_count, notes } = await request.json();
  if (typeof bag_count !== "number" || bag_count < 1) {
    return NextResponse.json({ error: "Enter at least 1 bag." }, { status: 400 });
  }

  const db = createServiceClient();
  const { error } = await db.from("discard_bag_counts").insert({
    discard_account_id,
    bag_count,
    entry_type: "add",
    notes: notes?.trim() || null,
  });

  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function GET() {
  const discard_account_id = await getDiscardAccountId();
  if (!discard_account_id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const { data: entries, error } = await db
    .from("discard_bag_counts")
    .select("id, bag_count, entry_type, notes, created_at")
    .eq("discard_account_id", discard_account_id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  let total = 0;
  const sinceLastPickup = [];
  for (const entry of entries || []) {
    if (entry.entry_type === "pickup") break;
    total += entry.bag_count || 0;
    sinceLastPickup.push(entry);
  }

  return NextResponse.json({ total, sinceLastPickup, allEntries: entries || [] });
}
