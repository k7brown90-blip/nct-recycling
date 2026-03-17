import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

const SLOT_CAPACITY = 5;

// GET — all shopping days with full booking manifest
export async function GET(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const upcoming = searchParams.get("upcoming") === "true";

  const db = createServiceClient();

  let query = db
    .from("shopping_days")
    .select(`
      id, shopping_date, status, created_at,
      pickup_routes (scheduled_date, scheduled_time, estimated_total_bags)
    `)
    .order("shopping_date", { ascending: false });

  if (upcoming) {
    const today = new Date().toISOString().split("T")[0];
    query = query.gte("shopping_date", today);
  }

  const { data: days, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  const dayIds = (days || []).map((d) => d.id);

  // Get all confirmed bookings with reseller and nonprofit info
  const { data: bookings } = await db
    .from("shopping_bookings")
    .select(`
      id, shopping_day_id, slot_type, status, notes, created_at,
      reseller_applications (id, full_name, business_name, email, phone),
      nonprofit_applications (id, org_name, contact_name, email, phone)
    `)
    .in("shopping_day_id", dayIds.length ? dayIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("status", "confirmed")
    .order("created_at", { ascending: true });

  const bookingsByDay = {};
  for (const b of bookings || []) {
    if (!bookingsByDay[b.shopping_day_id]) bookingsByDay[b.shopping_day_id] = [];
    bookingsByDay[b.shopping_day_id].push(b);
  }

  const NONPROFIT_BINS_CAPACITY = 2;

  const result = (days || []).map((day) => {
    const dayBookings = bookingsByDay[day.id] || [];
    const wholesale       = dayBookings.filter((b) => b.slot_type === "wholesale");
    const bins            = dayBookings.filter((b) => b.slot_type === "bins");
    const nonprofit_bins  = dayBookings.filter((b) => b.slot_type === "nonprofit_bins");

    return {
      ...day,
      slots: {
        wholesale:      { booked: wholesale.length,      capacity: SLOT_CAPACITY,             available: SLOT_CAPACITY - wholesale.length,             bookings: wholesale },
        bins:           { booked: bins.length,           capacity: SLOT_CAPACITY,             available: SLOT_CAPACITY - bins.length,                  bookings: bins },
        nonprofit_bins: { booked: nonprofit_bins.length, capacity: NONPROFIT_BINS_CAPACITY,   available: NONPROFIT_BINS_CAPACITY - nonprofit_bins.length, bookings: nonprofit_bins },
      },
    };
  });

  return NextResponse.json({ days: result });
}

// PATCH — update shopping day status (open/closed/cancelled)
export async function PATCH(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id, status } = await request.json();
  if (!id || !["open", "closed", "cancelled"].includes(status)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const db = createServiceClient();
  const { error } = await db.from("shopping_days").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });

  return NextResponse.json({ success: true });
}
