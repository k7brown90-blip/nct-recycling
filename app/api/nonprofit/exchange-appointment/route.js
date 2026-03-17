import { createClient } from "@/lib/supabase-server";
import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

// POST — nonprofit requests an exchange appointment
export async function POST(request) {
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

  const { appointment_type, preferred_date, categories_requested, notes } = await request.json();

  if (!["in_person", "delivery"].includes(appointment_type)) {
    return NextResponse.json({ error: "Invalid appointment type." }, { status: 400 });
  }

  const { data, error } = await db.from("exchange_appointments").insert({
    nonprofit_id: profile.application_id,
    appointment_type,
    preferred_date: preferred_date || null,
    categories_requested: categories_requested?.length ? categories_requested : null,
    notes: notes?.trim() || null,
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

  const { data: profile } = await db
    .from("profiles")
    .select("role, application_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "nonprofit" || !profile?.application_id) {
    return NextResponse.json({ error: "Not a nonprofit account." }, { status: 403 });
  }

  const { data, error } = await db
    .from("exchange_appointments")
    .select("*")
    .eq("nonprofit_id", profile.application_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  return NextResponse.json({ appointments: data });
}
