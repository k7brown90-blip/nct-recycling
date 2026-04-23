import { createServiceClient } from "@/lib/supabase";
import {
  completeOperationalStop,
  getOperationalRoutes,
  updateOperationalRouteStatus,
} from "@/lib/organization-operations";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

function checkAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.DRIVER_PIN}`;
}

// GET — calendar view, single date, or active routes
export async function GET(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const db = createServiceClient();
  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view");
  const date = searchParams.get("date");

  // Calendar view: minimal data for a date range
  if (view === "calendar") {
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    if (!start || !end) return NextResponse.json({ error: "start and end required." }, { status: 400 });

    try {
      const routes = await getOperationalRoutes(db, {
        startDate: start,
        endDate: end,
        statuses: ["scheduled", "in_progress", "completed"],
      });

      if (routes !== null) {
        const dates = {};
        for (const route of (routes || []).filter((item) => item.status !== "cancelled")) {
          dates[route.scheduled_date] = {
            id: route.id,
            status: route.status,
            stop_count: route.stops?.length || 0,
            completed_count: route.stops?.filter((stop) => stop.stop_status === "completed").length || 0,
          };
        }
        return NextResponse.json({ dates });
      }
    } catch (canonicalError) {
      console.error("Unified driver calendar load error:", canonicalError);
    }

    const { data: routes } = await db
      .from("pickup_routes")
      .select("id, scheduled_date, status")
      .gte("scheduled_date", start)
      .lte("scheduled_date", end)
      .neq("status", "cancelled");

    if (!routes?.length) return NextResponse.json({ dates: {} });

    const routeIds = routes.map((r) => r.id);
    const { data: stops } = await db
      .from("pickup_route_stops")
      .select("route_id, stop_status")
      .in("route_id", routeIds);

    const dates = {};
    for (const r of routes) {
      const routeStops = stops?.filter((s) => s.route_id === r.id) || [];
      dates[r.scheduled_date] = {
        id: r.id,
        status: r.status,
        stop_count: routeStops.length,
        completed_count: routeStops.filter((s) => s.stop_status === "completed").length,
      };
    }
    return NextResponse.json({ dates });
  }

  // Single date detail
  if (date) {
    try {
      const routes = await getOperationalRoutes(db, { scheduledDate: date });
      if (routes !== null) {
        const route = (routes || []).find((item) => item.status !== "cancelled") || null;
        return NextResponse.json({ route });
      }
    } catch (canonicalError) {
      console.error("Unified driver route detail load error:", canonicalError);
    }

    const { data: route } = await db
      .from("pickup_routes")
      .select("*")
      .eq("scheduled_date", date)
      .neq("status", "cancelled")
      .maybeSingle();

    if (!route) return NextResponse.json({ route: null });

    const { data: stops } = await db
      .from("pickup_route_stops")
      .select(`
        id, route_id, stop_order, estimated_bags, actual_bags, stop_status, completed_at, notes, no_inventory,
        nonprofit_id,
        nonprofit_applications (org_name, phone, address_street, address_city, address_state, available_pickup_hours, dock_instructions, storage_capacity_bags)
      `)
      .eq("route_id", route.id)
      .order("stop_order");

    return NextResponse.json({ route: { ...route, stops: stops || [] } });
  }

  // Default: active routes (scheduled + in_progress) with full stop detail
  try {
    const routes = await getOperationalRoutes(db, { statuses: ["scheduled", "in_progress"] });
    if (routes !== null) {
      return NextResponse.json({ routes });
    }
  } catch (canonicalError) {
    console.error("Unified driver active routes load error:", canonicalError);
  }

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
      id, route_id, stop_order, estimated_bags, actual_bags, stop_status, completed_at, notes, no_inventory,
      nonprofit_id,
      nonprofit_applications (org_name, phone, address_street, address_city, address_state, available_pickup_hours, dock_instructions, storage_capacity_bags)
    `)
    .in("route_id", routeIds.length ? routeIds : ["00000000-0000-0000-0000-000000000000"])
    .order("stop_order");

  const stopsByRoute = {};
  for (const s of stops || []) {
    if (!stopsByRoute[s.route_id]) stopsByRoute[s.route_id] = [];
    stopsByRoute[s.route_id].push(s);
  }

  return NextResponse.json({ routes: routes.map((r) => ({ ...r, stops: stopsByRoute[r.id] || [] })) });
}

// PATCH — complete stop (with bags or no_inventory), update route status
export async function PATCH(request) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json();
  const { action } = body;
  const db = createServiceClient();

  // Complete stop with actual bag count
  if (action === "complete_stop") {
    const { stop_id, nonprofit_id, route_id, actual_bags } = body;
    if (!stop_id) return NextResponse.json({ error: "Missing stop_id." }, { status: 400 });

    try {
      const completedStop = await completeOperationalStop(db, stop_id, {
        actualBags: actual_bags ?? null,
      });

      if (completedStop) {
        return NextResponse.json({ success: true, stop: completedStop });
      }
    } catch (canonicalError) {
      console.error("Unified driver stop completion error:", canonicalError);
    }

    await db.from("pickup_route_stops").update({
      stop_status: "completed",
      actual_bags: actual_bags ?? null,
      no_inventory: false,
      completed_at: new Date().toISOString(),
    }).eq("id", stop_id);

    // Reset this nonprofit's bag counter
    await db.from("bag_counts").insert({
      nonprofit_id,
      bag_count: 0,
      entry_type: "pickup",
      notes: `Picked up by NCT — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    });

    // Send pickup confirmation email to nonprofit
    if (route_id) {
      const [{ data: np }, { data: route }] = await Promise.all([
        db.from("nonprofit_applications").select("org_name, contact_name, email").eq("id", nonprofit_id).maybeSingle(),
        db.from("pickup_routes").select("scheduled_date").eq("id", route_id).maybeSingle(),
      ]);
      if (np?.email && route?.scheduled_date) {
        const dateStr = new Date(route.scheduled_date + "T12:00:00").toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        });
        resend.emails.send({
          from: "NCT Recycling <donate@nctrecycling.com>",
          to: np.email,
          subject: `Pickup Confirmed — ${dateStr}`,
          html: `
            <p>Hi ${np.contact_name?.split(" ")[0] || "there"},</p>
            <p>NCT picked up your donation bags from <strong>${np.org_name}</strong> on <strong>${dateStr}</strong>.</p>
            ${actual_bags ? `<p>We collected <strong>${actual_bags} bag${actual_bags !== 1 ? "s" : ""}</strong> — thank you for your contribution to the co-op!</p>` : ""}
            <p>Your bag count in the portal has been reset to zero. When your next load is ready, log in to submit a new pickup request.</p>
            <p>Questions? Call <a href="tel:+19702329108">(970) 232-9108</a> or email <a href="mailto:donate@nctrecycling.com">donate@nctrecycling.com</a>.</p>
            <p>— NCT Recycling Team</p>
          `,
        }).catch((err) => console.error("Pickup confirmation email error:", err));
      }
    }

    // Update route actual_total_bags
    if (actual_bags && route_id) {
      const { data: route } = await db.from("pickup_routes").select("actual_total_bags").eq("id", route_id).single();
      await db.from("pickup_routes").update({
        actual_total_bags: (route?.actual_total_bags || 0) + actual_bags,
      }).eq("id", route_id);
    }

    return NextResponse.json({ success: true });
  }

  // No inventory at this stop
  if (action === "no_inventory_stop") {
    const { stop_id, nonprofit_id, route_id } = body;
    if (!stop_id) return NextResponse.json({ error: "Missing stop_id." }, { status: 400 });

    try {
      const completedStop = await completeOperationalStop(db, stop_id, {
        actualBags: 0,
        noInventory: true,
      });

      if (completedStop) {
        return NextResponse.json({ success: true, consecutive_no_inventory: completedStop.consecutive_no_inventory, stop: completedStop });
      }
    } catch (canonicalError) {
      console.error("Unified driver no-inventory completion error:", canonicalError);
    }

    await db.from("pickup_route_stops").update({
      stop_status: "completed",
      actual_bags: 0,
      no_inventory: true,
      completed_at: new Date().toISOString(),
    }).eq("id", stop_id);

    // Check for consecutive no_inventory stops (missed pickup warning)
    // Returns true if the last 2 completed stops for this org were no_inventory
    const { data: recentStops } = await db
      .from("pickup_route_stops")
      .select("no_inventory, completed_at")
      .eq("nonprofit_id", nonprofit_id)
      .eq("stop_status", "completed")
      .order("completed_at", { ascending: false })
      .limit(2);

    const consecutiveMissed = recentStops?.length === 2 && recentStops.every((s) => s.no_inventory);

    return NextResponse.json({ success: true, consecutive_no_inventory: consecutiveMissed });
  }

  // Update route status
  if (action === "update_route_status") {
    const { route_id, status } = body;
    if (!route_id || !status) return NextResponse.json({ error: "Missing fields." }, { status: 400 });
    const valid = ["in_progress", "completed", "cancelled"];
    if (!valid.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });

    try {
      const updates = await updateOperationalRouteStatus(db, route_id, status);
      if (updates) {
        return NextResponse.json({ success: true, completion_type: updates.completion_type || null });
      }
    } catch (canonicalError) {
      console.error("Unified driver route status update error:", canonicalError);
    }

    if (status === "completed") {
      // Determine completion type: full if all stops done, partial otherwise
      const { data: stops } = await db
        .from("pickup_route_stops")
        .select("stop_status")
        .eq("route_id", route_id);

      const allDone = stops?.every((s) => s.stop_status === "completed");
      const completion_type = allDone ? "full" : "partial";

      await db.from("pickup_routes").update({ status: "completed", completion_type }).eq("id", route_id);

      return NextResponse.json({ success: true, completion_type });
    }

    await db.from("pickup_routes").update({ status }).eq("id", route_id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
