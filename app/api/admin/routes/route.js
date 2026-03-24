import { createServiceClient } from "@/lib/supabase";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

// GET — list pickup routes
export async function GET(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = createServiceClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = db
    .from("pickup_routes")
    .select("*")
    .order("scheduled_date", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data: routes, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load routes." }, { status: 500 });

  // Get stops for each route with nonprofit info
  const routeIds = routes.map((r) => r.id);
  const { data: stops } = await db
    .from("pickup_route_stops")
    .select(`
      id, route_id, stop_order, estimated_bags, actual_bags, stop_status, completed_at, notes,
      nonprofit_id,
      nonprofit_applications (org_name, contact_name, email, phone, address_street, address_city, address_state)
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

// POST — create a new pickup route, notify nonprofits and resellers
export async function POST(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { scheduled_date, scheduled_time, notes, stops } = await request.json();
  // stops = [{ nonprofit_id, stop_order, estimated_bags, notes }]

  if (!scheduled_date || !stops?.length) {
    return NextResponse.json({ error: "Date and at least one stop are required." }, { status: 400 });
  }

  const db = createServiceClient();

  const estimated_total_bags = stops.reduce((sum, s) => sum + (s.estimated_bags || 0), 0);

  // Shopping day = day after pickup, skip Friday (5) and Saturday (6)
  const shoppingDay = new Date(scheduled_date);
  shoppingDay.setDate(shoppingDay.getDate() + 1);
  while ([5, 6].includes(shoppingDay.getDay())) {
    shoppingDay.setDate(shoppingDay.getDate() + 1);
  }
  const shopping_date = shoppingDay.toISOString().split("T")[0];

  // Create route
  const { data: route, error: routeError } = await db
    .from("pickup_routes")
    .insert({
      scheduled_date,
      shopping_date,
      scheduled_time: scheduled_time || null,
      notes: notes || null,
      estimated_total_bags,
      status: "scheduled",
    })
    .select("id")
    .single();

  if (routeError) {
    console.error("Route insert error:", routeError);
    return NextResponse.json({ error: "Failed to create route." }, { status: 500 });
  }

  // Insert stops
  const stopRows = stops.map((s, i) => ({
    route_id: route.id,
    nonprofit_id: s.nonprofit_id,
    stop_order: s.stop_order ?? i + 1,
    estimated_bags: s.estimated_bags || null,
    notes: s.notes || null,
  }));

  await db.from("pickup_route_stops").insert(stopRows);

  // Auto-create shopping day (day after pickup)
  await db.from("shopping_days").insert({
    route_id: route.id,
    shopping_date: shopping_date,
    status: "open",
  });

  // Fetch nonprofit details for notification
  const nonprofitIds = stops.map((s) => s.nonprofit_id);
  const { data: nonprofits } = await db
    .from("nonprofit_applications")
    .select("id, org_name, contact_name, email")
    .in("id", nonprofitIds);

  // Pickup date display
  const pickupDateStr = new Date(scheduled_date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const shoppingDateStr = new Date(shopping_date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // Notify each nonprofit on the route
  const nonprofitEmails = (nonprofits || []).map((np) =>
    resend.emails.send({
      from: "NCT Recycling <donate@nctrecycling.com>",
      to: np.email,
      subject: `Pickup Scheduled — ${pickupDateStr}`,
      html: `
        <h2>Your Pickup Has Been Scheduled</h2>
        <p>Hi ${np.contact_name?.split(" ")[0] || "there"},</p>
        <p>NCT Recycling has scheduled a donation pickup from <strong>${np.org_name}</strong>.</p>
        <p><strong>Pickup Date:</strong> ${pickupDateStr}${scheduled_time ? `<br><strong>Estimated Time:</strong> ${scheduled_time}` : ""}</p>
        ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}
        <p>Please ensure your donated bags are accessible and your bag count in the portal is up to date before the pickup date.</p>
        <p>Questions? Call us at (970) 232-9108 or email donate@nctrecycling.com.</p>
        <p>— NCT Recycling Team</p>
      `,
    }).catch((err) => console.error("Nonprofit email error:", err))
  );

  // Notify all approved resellers — shopping opens the day AFTER pickup
  const { data: resellers } = await db
    .from("reseller_applications")
    .select("email, full_name, business_name")
    .eq("status", "approved");

  const resellerEmails = (resellers || []).map((r) =>
    resend.emails.send({
      from: "NCT Recycling <donate@nctrecycling.com>",
      to: r.email,
      subject: `New Load Available for Shopping — ${shoppingDateStr}`,
      html: `
        <h2>Fresh Load Available at NCT Recycling</h2>
        <p>Hi ${r.full_name?.split(" ")[0] || "there"},</p>
        <p>A pickup route has been scheduled for <strong>${pickupDateStr}</strong>. Once the load is processed, shopping opens the following day.</p>
        <table style="border-collapse:collapse;width:100%;max-width:500px;margin:16px 0">
          <tr style="background:#0b2a45;color:white">
            <td style="padding:10px 16px;font-weight:bold">Pickup Date</td>
            <td style="padding:10px 16px">${pickupDateStr}</td>
          </tr>
          <tr style="background:#f9f5e8">
            <td style="padding:10px 16px;font-weight:bold;color:#0b2a45">Shopping Opens</td>
            <td style="padding:10px 16px;font-weight:bold;color:#d49a22">${shoppingDateStr}</td>
          </tr>
        </table>
        <p>Log in to your reseller portal to schedule your shopping visit for <strong>${shoppingDateStr}</strong>.</p>
        <p style="margin-top:16px">
          <a href="https://www.nctrecycling.com/reseller/dashboard" style="background:#0b2a45;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block">
            Schedule Your Visit →
          </a>
        </p>
        <p style="margin-top:12px;font-size:13px;color:#666">
          Questions? <a href="tel:+19702329108" style="color:#0b2a45">(970) 232-9108</a> &nbsp;|&nbsp;
          <a href="mailto:donate@nctrecycling.com" style="color:#0b2a45">donate@nctrecycling.com</a>
        </p>
        <p>— NCT Recycling Team</p>
      `,
    }).catch((err) => console.error("Reseller email error:", err))
  );

  await Promise.allSettled([...nonprofitEmails, ...resellerEmails]);

  // Mark notifications sent
  await db.from("pickup_routes").update({
    nonprofits_notified_at: new Date().toISOString(),
    resellers_notified_at: new Date().toISOString(),
  }).eq("id", route.id);

  return NextResponse.json({ success: true, id: route.id });
}

// PATCH — mark a stop complete (resets nonprofit bag counter) or update route status
export async function PATCH(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;
  const db = createServiceClient();

  // ── Complete an individual stop ──
  if (action === "complete_stop") {
    const { stop_id, nonprofit_id, route_id, actual_bags } = body;
    if (!stop_id || !nonprofit_id) {
      return NextResponse.json({ error: "Missing stop_id or nonprofit_id." }, { status: 400 });
    }

    // Mark stop completed
    const { error: stopError } = await db
      .from("pickup_route_stops")
      .update({
        stop_status: "completed",
        actual_bags: actual_bags ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", stop_id);

    if (stopError) return NextResponse.json({ error: "Failed to update stop." }, { status: 500 });

    // Insert a pickup reset entry — resets this nonprofit's running bag counter to 0
    await db.from("bag_counts").insert({
      nonprofit_id,
      bag_count: 0,
      entry_type: "pickup",
      notes: `Picked up by NCT — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    });

    // Update route's actual_total_bags running sum
    if (actual_bags && route_id) {
      const { data: route } = await db
        .from("pickup_routes")
        .select("actual_total_bags")
        .eq("id", route_id)
        .single();
      await db.from("pickup_routes").update({
        actual_total_bags: (route?.actual_total_bags || 0) + actual_bags,
      }).eq("id", route_id);
    }

    return NextResponse.json({ success: true });
  }

  // ── Update route status ──
  if (action === "update_route_status") {
    const { route_id, status } = body;
    if (!route_id || !status) {
      return NextResponse.json({ error: "Missing route_id or status." }, { status: 400 });
    }
    const valid = ["scheduled", "in_progress", "completed", "cancelled"];
    if (!valid.includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    const { error } = await db.from("pickup_routes").update({ status }).eq("id", route_id);
    if (error) return NextResponse.json({ error: "Failed to update route." }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
