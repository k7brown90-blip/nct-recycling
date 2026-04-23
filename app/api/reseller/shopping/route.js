import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { getShopifyStoreUrl } from "@/lib/shopify";
import { NextResponse } from "next/server";

async function getResellerProfile(user, db) {
  const profile = await getOrCreateProfile(user, db);

  if (!["reseller", "both"].includes(profile?.role) || !profile?.application_id) return null;

  const { data: reseller } = await db
    .from("reseller_applications")
    .select("id, full_name, email, business_name")
    .eq("id", profile.application_id)
    .maybeSingle();

  return reseller;
}

// GET — retired booking endpoint retained for compatibility
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const reseller = await getResellerProfile(user, db);
  if (!reseller) return NextResponse.json({ error: "Not a reseller account." }, { status: 403 });

  return NextResponse.json({
    retired: true,
    message: "Shopping-day booking has been retired. Use the curated online store instead.",
    store_url: getShopifyStoreUrl(),
    days: [],
  });
}

// POST — book a slot
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const reseller = await getResellerProfile(user, db);
  if (!reseller) return NextResponse.json({ error: "Not a reseller account." }, { status: 403 });

  return NextResponse.json({
    error: "Shopping-day booking has been retired. Use the curated online store instead.",
    store_url: getShopifyStoreUrl(),
  }, { status: 410 });
}

// DELETE — cancel a booking (by shopping_day_id + slot_type)
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const reseller = await getResellerProfile(user, db);
  if (!reseller) return NextResponse.json({ error: "Not a reseller account." }, { status: 403 });

  return NextResponse.json({
    error: "Booking cancellations are no longer needed because shopping-day bookings are retired.",
    store_url: getShopifyStoreUrl(),
  }, { status: 410 });
}
