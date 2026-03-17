import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

// POST — nonprofit submits their current bag count
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();

  // Verify user is a nonprofit
  const { data: profile } = await db
    .from("profiles")
    .select("role, application_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "nonprofit" || !profile?.application_id) {
    return NextResponse.json({ error: "Not a nonprofit account." }, { status: 403 });
  }

  const { bag_count, notes } = await request.json();

  if (typeof bag_count !== "number" || bag_count < 0) {
    return NextResponse.json({ error: "Invalid bag count." }, { status: 400 });
  }

  const { error } = await db.from("bag_counts").insert({
    nonprofit_id: profile.application_id,
    bag_count,
    notes: notes?.trim() || null,
  });

  if (error) {
    console.error("Bag count insert error:", error);
    return NextResponse.json({ error: "Failed to save bag count." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// GET — get this nonprofit's bag count history
export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();

  const { data: profile } = await db
    .from("profiles")
    .select("role, application_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "nonprofit" || !profile?.application_id) {
    return NextResponse.json({ error: "Not a nonprofit account." }, { status: 403 });
  }

  const { data, error } = await db
    .from("bag_counts")
    .select("*")
    .eq("nonprofit_id", profile.application_id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  return NextResponse.json({ history: data });
}
