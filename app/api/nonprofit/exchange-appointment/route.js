import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { getOrCreateProfile } from "@/lib/auth-profile";
import { NextResponse } from "next/server";

async function getNonprofitProfile(user, db) {
  const profile = await getOrCreateProfile(user, db);

  if (profile?.role !== "nonprofit" || !profile?.application_id) return null;
  return profile;
}

// POST — nonprofit requests an exchange appointment
export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const profile = await getNonprofitProfile(user, db);
  if (!profile) return NextResponse.json({ error: "Not a nonprofit account." }, { status: 403 });

  const { appointment_type, preferred_date, categories_requested, notes, estimated_bags, ship_to_address } = await request.json();

  if (!["in_person", "delivery"].includes(appointment_type)) {
    return NextResponse.json({ error: "Invalid appointment type." }, { status: 400 });
  }

  if (appointment_type === "delivery" && !ship_to_address?.trim()) {
    return NextResponse.json({ error: "Shipping address is required for delivery." }, { status: 400 });
  }

  const { data, error } = await db.from("exchange_appointments").insert({
    nonprofit_id: profile.application_id,
    appointment_type,
    preferred_date: preferred_date || null,
    categories_requested: categories_requested?.length ? categories_requested : null,
    notes: notes?.trim() || null,
    estimated_bags: estimated_bags || null,
    ship_to_address: appointment_type === "delivery" ? ship_to_address?.trim() || null : null,
    status: "requested",
  }).select("id").single();

  if (error) {
    console.error("Exchange appointment insert error:", error);
    return NextResponse.json({ error: "Failed to submit request." }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id });
}

// GET — get this nonprofit's exchange appointments
export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const profile = await getNonprofitProfile(user, db);
  if (!profile) return NextResponse.json({ error: "Not a nonprofit account." }, { status: 403 });

  const { data, error } = await db
    .from("exchange_appointments")
    .select("*")
    .eq("nonprofit_id", profile.application_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  return NextResponse.json({ appointments: data });
}

// PATCH — nonprofit confirms or declines a delivery quote
export async function PATCH(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const profile = await getNonprofitProfile(user, db);
  if (!profile) return NextResponse.json({ error: "Not a nonprofit account." }, { status: 403 });

  const { id, action } = await request.json();

  if (!id || !["confirm_quote", "decline_quote"].includes(action)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // Verify this appointment belongs to this nonprofit
  const { data: appt } = await db
    .from("exchange_appointments")
    .select("id, quote_status, nonprofit_id")
    .eq("id", id)
    .maybeSingle();

  if (!appt || appt.nonprofit_id !== profile.application_id) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }

  if (appt.quote_status !== "quoted") {
    return NextResponse.json({ error: "No pending quote to respond to." }, { status: 400 });
  }

  const { error } = await db
    .from("exchange_appointments")
    .update({ quote_status: action === "confirm_quote" ? "confirmed" : "declined" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: "Failed to update." }, { status: 500 });

  return NextResponse.json({ success: true });
}
