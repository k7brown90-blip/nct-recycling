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
    .select("id, full_name, email")
    .eq("id", profile.application_id)
    .maybeSingle();
  return reseller;
}

// GET — all confirmed bookings for this reseller (upcoming + past)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const reseller = await getResellerProfile(user, db);
  if (!reseller) return NextResponse.json({ error: "Not a reseller account." }, { status: 403 });

  return NextResponse.json({
    retired: true,
    message: "Booking history is retired because reseller shopping now happens through the online store.",
    store_url: getShopifyStoreUrl(),
    upcoming: [],
    past: [],
  });
}

// DELETE — cancel a booking by booking id
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
