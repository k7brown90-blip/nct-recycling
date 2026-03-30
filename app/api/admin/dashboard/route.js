import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

export async function GET(request) {
  if (!checkAdminAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const today = new Date().toISOString().split("T")[0];

  const [
    { count: pendingResellers },
    { count: pendingNonprofits },
    { count: pendingPickupRequests },
    { data: todayRoute },
    { data: nextShoppingDay },
  ] = await Promise.all([
    db.from("reseller_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("nonprofit_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("nonprofit_pickup_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("pickup_routes").select("id, scheduled_date, status, estimated_total_bags, actual_total_bags").eq("scheduled_date", today).neq("status", "cancelled").maybeSingle(),
    db.from("shopping_days").select("id, shopping_date, status").gte("shopping_date", today).order("shopping_date", { ascending: true }).limit(1).maybeSingle(),
  ]);

  // Count bookings for next shopping day
  let nextDayBookings = 0;
  if (nextShoppingDay) {
    const { count } = await db
      .from("shopping_bookings")
      .select("id", { count: "exact", head: true })
      .eq("shopping_day_id", nextShoppingDay.id)
      .eq("status", "confirmed");
    nextDayBookings = count || 0;
  }

  return NextResponse.json({
    pending_resellers: pendingResellers || 0,
    pending_nonprofits: pendingNonprofits || 0,
    pending_pickup_requests: pendingPickupRequests || 0,
    today_route: todayRoute || null,
    next_shopping_day: nextShoppingDay ? { ...nextShoppingDay, booking_count: nextDayBookings } : null,
  });
}
