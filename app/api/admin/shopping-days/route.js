import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

const LBS_PER_BAG             = 20;
const LBS_PER_WHOLESALE_SPOT  = 500;
const BINS_WEEKDAY_CAP        = 10;
const BINS_SUNDAY_CAP         = 999; // display as "Open / No cap"
const NONPROFIT_BINS_CAPACITY = 2;

function isSunday(dateStr) {
  return new Date(dateStr + "T12:00:00").getDay() === 0;
}

function calcWholesaleCap(day, route) {
  if (day.wholesale_capacity != null) return day.wholesale_capacity;
  const bags = route?.actual_total_bags || route?.estimated_total_bags || 0;
  return Math.max(1, Math.floor((bags * LBS_PER_BAG) / LBS_PER_WHOLESALE_SPOT));
}

function calcBinsCap(day) {
  if (day.bins_capacity != null) return day.bins_capacity;
  return isSunday(day.shopping_date) ? BINS_SUNDAY_CAP : BINS_WEEKDAY_CAP;
}

export async function GET(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const upcoming = searchParams.get("upcoming") === "true";

  const db = createServiceClient();

  let query = db
    .from("shopping_days")
    .select(`
      id, shopping_date, status, admin_notes, wholesale_capacity, bins_capacity, created_at,
      pickup_routes (id, scheduled_date, scheduled_time, estimated_total_bags, actual_total_bags)
    `)
    .order("shopping_date", { ascending: false });

  if (upcoming) {
    const today = new Date().toISOString().split("T")[0];
    query = query.gte("shopping_date", today);
  }

  const { data: days, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load." }, { status: 500 });

  const dayIds = (days || []).map((d) => d.id);

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

  const result = (days || []).map((day) => {
    const route  = day.pickup_routes;
    const wCap   = calcWholesaleCap(day, route);
    const bCap   = calcBinsCap(day);
    const sunday = isSunday(day.shopping_date);

    const dayBookings   = bookingsByDay[day.id] || [];
    const wholesale     = dayBookings.filter((b) => b.slot_type === "wholesale");
    const bins          = dayBookings.filter((b) => b.slot_type === "bins");
    const nonprofit_bins = dayBookings.filter((b) => b.slot_type === "nonprofit_bins");

    return {
      ...day,
      is_sunday: sunday,
      // wholesale_capacity_auto = what auto-calc gives (shown in UI even when overridden)
      wholesale_capacity_auto: (() => {
        const bags = route?.actual_total_bags || route?.estimated_total_bags || 0;
        return Math.max(1, Math.floor((bags * LBS_PER_BAG) / LBS_PER_WHOLESALE_SPOT));
      })(),
      slots: {
        wholesale: {
          booked: wholesale.length, capacity: wCap,
          available: wCap - wholesale.length,
          bookings: wholesale,
        },
        bins: {
          booked: bins.length, capacity: bCap,
          available: bCap === BINS_SUNDAY_CAP ? null : bCap - bins.length,
          bookings: bins,
        },
        nonprofit_bins: {
          booked: nonprofit_bins.length, capacity: NONPROFIT_BINS_CAPACITY,
          available: NONPROFIT_BINS_CAPACITY - nonprofit_bins.length,
          bookings: nonprofit_bins,
        },
      },
    };
  });

  return NextResponse.json({ days: result });
}

// POST — generate upcoming Sundays OR create a single day
export async function POST(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json();
  const db = createServiceClient();

  if (body.action === "generate_sundays") {
    const weeks = body.weeks || 8;
    const d = new Date();
    // Advance to next Sunday (or today if already Sunday)
    const daysUntilSun = (7 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSun);

    const dates = [];
    for (let i = 0; i < weeks; i++) {
      dates.push(d.toISOString().split("T")[0]);
      d.setDate(d.getDate() + 7);
    }

    let created = 0;
    for (const dateStr of dates) {
      const { error } = await db.from("shopping_days").insert({
        shopping_date: dateStr,
        status: "open",
        route_id: null,
      });
      if (!error) created++;
      // conflict (already exists) = skip silently
    }

    return NextResponse.json({ success: true, created, dates });
  }

  // Create a single shopping day
  const { shopping_date, status, wholesale_capacity, bins_capacity, admin_notes } = body;
  if (!shopping_date) return NextResponse.json({ error: "shopping_date required." }, { status: 400 });

  const { data, error } = await db.from("shopping_days").insert({
    shopping_date,
    status: status || "open",
    route_id: null,
    wholesale_capacity: wholesale_capacity != null && wholesale_capacity !== "" ? parseInt(wholesale_capacity) : null,
    bins_capacity:      bins_capacity      != null && bins_capacity      !== "" ? parseInt(bins_capacity)      : null,
    admin_notes: admin_notes || null,
  }).select("id").single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "A shopping day already exists for that date." }, { status: 409 });
    return NextResponse.json({ error: "Failed to create." }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id });
}

// PATCH — update status, capacities, or notes
export async function PATCH(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const updates = {};
  if (body.status !== undefined) {
    if (!["open", "closed", "cancelled"].includes(body.status))
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    updates.status = body.status;
  }
  if (body.wholesale_capacity !== undefined)
    updates.wholesale_capacity = body.wholesale_capacity === "" || body.wholesale_capacity === null ? null : parseInt(body.wholesale_capacity);
  if (body.bins_capacity !== undefined)
    updates.bins_capacity = body.bins_capacity === "" || body.bins_capacity === null ? null : parseInt(body.bins_capacity);
  if (body.admin_notes !== undefined)
    updates.admin_notes = body.admin_notes || null;

  const db = createServiceClient();
  const { error } = await db.from("shopping_days").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: "Update failed." }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE — remove a shopping day
export async function DELETE(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  const db = createServiceClient();
  const { error } = await db.from("shopping_days").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  return NextResponse.json({ success: true });
}
