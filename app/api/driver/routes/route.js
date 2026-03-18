import { createServiceClient } from "@/lib/supabase";
import { NextResponse } from "next/server";

function checkAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.DRIVER_PIN}`;
}

// GET — active routes (scheduled + in_progress)
export async function GET(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();

  const { data: routes, error } = await db
    .from("pickup_routes")
    .select("*")
    .in("status", ["scheduled", "in_progress"])
    .order("scheduled_date", { ascending: true });

  if (error) return NextResponse.json({ error: "Failed to load routes." }, { status: 500 });

  const routeIds = routes.map((r) => r.id);
  const { data: stops } = await db
    .from("pickup_route_stops")
    .select(`
      id, route_id, stop_order, estimated_bags, actual_bags, stop_status, completed_at, notes,
      nonprofit_id,
      nonprofit_applications (org_name, phone, address_street, address_city, address_state, available_pickup_hours, dock_instructions)
    `)
    .in("route_id", routeIds.length ? routeIds : ["00000000-0000-0000-0000-000000000000"])
    .order("stop_order");

  const stopsByRoute = {};
  for (const s of stops || []) {
    if (!stopsByRoute[s.route_id]) stopsByRoute[s.route_id] = [];
    stopsByRoute[s.route_id].push(s);
  }

  const result = routes.map((r) => ({ ...r, stops: stopsByRoute[r.id] || [] }));
  return NextResponse.json({ routes: result });
}

// PATCH — mark stop complete + reset bag counter, or update route status
export async function PATCH(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json();
  const { action } = body;
  const db = createServiceClient();

  if (action === "complete_stop") {
    const { stop_id, nonprofit_id, route_id, actual_bags } = body;
    if (!stop_id || !nonprofit_id) return NextResponse.json({ error: "Missing fields." }, { status: 400 });

    await db.from("pickup_route_stops").update({
      stop_status: "completed",
      actual_bags: actual_bags ?? null,
      completed_at: new Date().toISOString(),
    }).eq("id", stop_id);

    // Reset this nonprofit's bag counter
    await db.from("bag_counts").insert({
      nonprofit_id,
      bag_count: 0,
      entry_type: "pickup",
      notes: `Picked up by NCT — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    });

    // Update route actual_total_bags
    if (actual_bags && route_id) {
      const { data: route } = await db.from("pickup_routes").select("actual_total_bags").eq("id", route_id).single();
      await db.from("pickup_routes").update({
        actual_total_bags: (route?.actual_total_bags || 0) + actual_bags,
      }).eq("id", route_id);
    }

    return NextResponse.json({ success: true });
  }

  if (action === "update_route_status") {
    const { route_id, status } = body;
    if (!route_id || !status) return NextResponse.json({ error: "Missing fields." }, { status: 400 });
    const valid = ["in_progress", "completed", "cancelled"];
    if (!valid.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    await db.from("pickup_routes").update({ status }).eq("id", route_id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
