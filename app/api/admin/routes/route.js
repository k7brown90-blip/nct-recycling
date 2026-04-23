import { createServiceClient } from "@/lib/supabase";
import {
  completeCanonicalCoOpStop,
  createCanonicalCoOpRoute,
  getCanonicalCoOpRoutes,
  markCanonicalCoOpPickupCollected,
  syncCanonicalCoOpRouteAggregate,
  updateCanonicalCoOpRequestStatus,
  updateCanonicalCoOpRouteStatus,
} from "@/lib/co-op-canonical";
import {
  completeOperationalStop,
  createOperationalRoute,
  getOperationalRoutes,
  updateOperationalRouteStatus,
} from "@/lib/organization-operations";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

function checkAdminAuth(request) {
  return request.headers.get("authorization") === `Bearer ${process.env.ADMIN_SECRET}`;
}

async function syncLegacyRouteAggregate(db, routeId) {
  const { data: stops, error: stopsError } = await db
    .from("pickup_route_stops")
    .select("actual_bags, no_inventory, stop_status")
    .eq("route_id", routeId);

  if (stopsError) {
    throw stopsError;
  }

  const normalizedStops = stops || [];
  const allResolved = normalizedStops.length > 0 && normalizedStops.every((stop) => ["completed", "skipped"].includes(stop.stop_status));
  const completionType = normalizedStops.some((stop) => stop.no_inventory || stop.stop_status === "skipped") ? "partial" : "full";
  const actualTotalBags = normalizedStops.reduce((sum, stop) => sum + Number(stop.actual_bags || 0), 0);

  const updates = {
    actual_total_bags: actualTotalBags,
    completion_type: allResolved ? completionType : null,
  };

  if (allResolved) {
    updates.status = "completed";
  }

  const { error: routeError } = await db
    .from("pickup_routes")
    .update(updates)
    .eq("id", routeId);

  if (routeError) {
    throw routeError;
  }

  return updates;
}

async function ensureShoppingDayOpen(db, shoppingDate) {
  if (!shoppingDate) return;

  const { data: existingDay } = await db
    .from("shopping_days")
    .select("id")
    .eq("shopping_date", shoppingDate)
    .maybeSingle();

  if (existingDay?.id) {
    await db.from("shopping_days").update({ status: "open" }).eq("id", existingDay.id);
    return;
  }

  await db.from("shopping_days").insert({
    shopping_date: shoppingDate,
    status: "open",
    route_id: null,
  });
}

// GET — list pickup routes
export async function GET(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = createServiceClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  try {
    const canonicalRoutes = await getOperationalRoutes(db, { status: status || null });
    if (canonicalRoutes !== null) {
      return NextResponse.json({ routes: canonicalRoutes });
    }
  } catch (canonicalError) {
    console.error("Unified operations routes load error:", canonicalError);
  }

  const query = db
    .from("pickup_routes")
    .select("*")
    .order("scheduled_date", { ascending: false });

  const { data: routes, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load routes." }, { status: 500 });

  // Get stops for each route with nonprofit info
  const routeIds = (routes || []).map((r) => r.id);
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

  const legacyRoutes = (routes || []).map((route) => ({ ...route, stops: stopsByRoute[route.id] || [] }));

  try {
    const canonicalRoutes = await getCanonicalCoOpRoutes(db);
    if (canonicalRoutes) {
      const mergedRoutes = new Map(legacyRoutes.map((route) => [route.id, route]));

      for (const canonicalRoute of canonicalRoutes) {
        const legacyRoute = mergedRoutes.get(canonicalRoute.id);
        const legacyStopsByKey = new Map(
          (legacyRoute?.stops || []).map((stop) => [
            `${stop.stop_order}:${stop.nonprofit_id || stop.nonprofit_applications?.id || ""}`,
            stop,
          ])
        );
        const mergedStops = (canonicalRoute.stops || []).map((stop) => {
          const key = `${stop.stop_order}:${stop.nonprofit_id || stop.nonprofit_applications?.id || ""}`;
          const legacyStop = legacyStopsByKey.get(key);
          return legacyStop
            ? { ...legacyStop, ...stop, id: legacyStop.id }
            : stop;
        });
        mergedRoutes.set(canonicalRoute.id, {
          ...legacyRoute,
          ...canonicalRoute,
          stops: mergedStops.length ? mergedStops : legacyRoute?.stops || [],
        });
      }

      const effectiveRoutes = [...mergedRoutes.values()]
        .filter((route) => !status || route.status === status)
        .sort((left, right) => new Date(right.scheduled_date) - new Date(left.scheduled_date));

      return NextResponse.json({ routes: effectiveRoutes });
    }
  } catch (canonicalError) {
    console.error("Canonical co-op routes load error:", canonicalError);
  }

  const filteredLegacyRoutes = status ? legacyRoutes.filter((route) => route.status === status) : legacyRoutes;
  return NextResponse.json({ routes: filteredLegacyRoutes });
}

// POST — create a new pickup route, notify nonprofits and resellers
export async function POST(request) {
  if (!checkAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { scheduled_date, scheduled_time, notes, stops } = await request.json();
  // stops = [{ organization_id, enrollment_id, org_name, email, stop_order, estimated_bags, notes }]

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

  try {
    const routeId = await createOperationalRoute(db, {
      scheduled_date,
      scheduled_time,
      shopping_date,
      notes,
      stops,
    });

    if (routeId) {
      await ensureShoppingDayOpen(db, shopping_date);

      const pickupDateStr = new Date(scheduled_date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });

      const shoppingDateStr = new Date(shopping_date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });

      const organizationEmails = (stops || [])
        .filter((stop) => stop.email)
        .map((stop) =>
          resend.emails.send({
            from: "NCT Recycling <donate@nctrecycling.com>",
            to: stop.email,
            subject: `Pickup Scheduled - ${pickupDateStr}`,
            html: `
              <h2>Your Pickup Has Been Scheduled</h2>
              <p>Hello,</p>
              <p>NCT Recycling has scheduled a pickup from <strong>${stop.org_name || "your organization"}</strong>.</p>
              <p><strong>Pickup Date:</strong> ${pickupDateStr}${scheduled_time ? `<br><strong>Estimated Time:</strong> ${scheduled_time}` : ""}</p>
              ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}
              <p>Please ensure your bags are accessible and your portal count is current before the pickup date.</p>
              <p>Questions? Call us at (970) 232-9108 or email donate@nctrecycling.com.</p>
              <p>- NCT Recycling Team</p>
            `,
          }).catch((err) => console.error("Organization route email error:", err))
        );

      const { data: resellers } = await db
        .from("reseller_applications")
        .select("email, full_name")
        .eq("status", "approved");

      const resellerEmails = (resellers || []).map((reseller) =>
        resend.emails.send({
          from: "NCT Recycling <donate@nctrecycling.com>",
          to: reseller.email,
          subject: `Shopping Day Confirmed - Book Now for ${shoppingDateStr}`,
          html: `
            <h2>New Shopping Day Available - Book Your Spot Now</h2>
            <p>Hi ${reseller.full_name?.split(" ")[0] || "there"},</p>
            <p>A fresh load is being picked up on <strong>${pickupDateStr}</strong> and shopping opens the next day.</p>
            <p><strong>Shopping Opens:</strong> ${shoppingDateStr}</p>
            <p><a href="https://www.nctrecycling.com/reseller/dashboard">Book My Shopping Visit</a></p>
            <p>- NCT Recycling Team</p>
          `,
        }).catch((err) => console.error("Reseller email error:", err))
      );

      await Promise.allSettled([...organizationEmails, ...resellerEmails]);

      await db.from("pickup_runs").update({
        nonprofits_notified_at: new Date().toISOString(),
        resellers_notified_at: new Date().toISOString(),
      }).eq("id", routeId);

      return NextResponse.json({ success: true, id: routeId });
    }
  } catch (canonicalError) {
    console.error("Unified operations route create error:", canonicalError);
  }

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

  try {
    await createCanonicalCoOpRoute(db, route.id, {
      scheduled_date,
      scheduled_time,
      shopping_date,
      notes,
      stops: stopRows,
    });
  } catch (canonicalError) {
    console.error("Canonical co-op route create sync error:", canonicalError);
  }

  // Mark any pending pickup requests for nonprofits on this route as scheduled
  const nonprofitIds = stops.map((s) => s.nonprofit_id);
  await db
    .from("nonprofit_pickup_requests")
    .update({ status: "scheduled" })
    .in("nonprofit_id", nonprofitIds)
    .eq("status", "pending");

  await Promise.allSettled(
    nonprofitIds.map((nonprofitId) => updateCanonicalCoOpRequestStatus(db, nonprofitId, "scheduled"))
  );

  // Fetch nonprofit details for notification
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
      subject: `Shopping Day Confirmed — Book Now for ${shoppingDateStr}`,
      html: `
        <h2>New Shopping Day Available — Book Your Spot Now</h2>
        <p>Hi ${r.full_name?.split(" ")[0] || "there"},</p>
        <p>A fresh load is being picked up on <strong>${pickupDateStr}</strong> and shopping opens the next day.</p>
        <table style="border-collapse:collapse;width:100%;max-width:500px;margin:16px 0">
          <tr style="background:#0b2a45;color:white">
            <td style="padding:10px 16px;font-weight:bold">Pickup Date</td>
            <td style="padding:10px 16px">${pickupDateStr}</td>
          </tr>
          <tr style="background:#f9f5e8">
            <td style="padding:10px 16px;font-weight:bold;color:#0b2a45">🛒 Shopping Opens</td>
            <td style="padding:10px 16px;font-weight:bold;color:#d49a22">${shoppingDateStr}</td>
          </tr>
        </table>
        <p><strong>Shopping visits are limited — book your time slot now to secure your spot.</strong></p>
        <p style="margin-top:16px">
          <a href="https://www.nctrecycling.com/reseller/dashboard" style="background:#d49a22;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;font-weight:bold;display:inline-block;font-size:16px">
            Book My Shopping Visit →
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

  try {
    await updateCanonicalCoOpRouteStatus(db, route.id, "scheduled", {
      nonprofits_notified_at: new Date().toISOString(),
      resellers_notified_at: new Date().toISOString(),
    });
  } catch (canonicalError) {
    console.error("Canonical co-op route notification sync error:", canonicalError);
  }

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
    if (!stop_id) {
      return NextResponse.json({ error: "Missing stop_id." }, { status: 400 });
    }

    try {
      const completedStop = await completeOperationalStop(db, stop_id, {
        actualBags: actual_bags ?? null,
      });

      if (completedStop) {
        return NextResponse.json({ success: true });
      }
    } catch (canonicalError) {
      console.error("Unified operations stop completion error:", canonicalError);
    }

    // Mark stop completed
    const { error: stopError } = await db
      .from("pickup_route_stops")
      .update({
        stop_status: "completed",
        actual_bags: actual_bags ?? null,
        no_inventory: actual_bags == null || Number(actual_bags) === 0,
        completed_at: new Date().toISOString(),
      })
      .eq("id", stop_id);

    if (stopError) return NextResponse.json({ error: "Failed to update stop." }, { status: 500 });

    const { data: legacyStop } = await db
      .from("pickup_route_stops")
      .select("stop_order, notes")
      .eq("id", stop_id)
      .maybeSingle();

    // Insert a pickup reset entry — resets this nonprofit's running bag counter to 0
    await db.from("bag_counts").insert({
      nonprofit_id,
      bag_count: 0,
      entry_type: "pickup",
      notes: `Picked up by NCT — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
    });

    try {
      if (route_id && legacyStop?.stop_order != null) {
        await completeCanonicalCoOpStop(
          db,
          route_id,
          nonprofit_id,
          legacyStop.stop_order,
          actual_bags ?? null,
          new Date().toISOString(),
          legacyStop.notes || null
        );
        await syncCanonicalCoOpRouteAggregate(db, route_id);
      }
      await markCanonicalCoOpPickupCollected(db, nonprofit_id, `Picked up by NCT - ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`);
      await updateCanonicalCoOpRequestStatus(db, nonprofit_id, "completed");
    } catch (canonicalError) {
      console.error("Canonical co-op pickup completion sync error:", canonicalError);
    }

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

    if (route_id) {
      try {
        await syncLegacyRouteAggregate(db, route_id);
      } catch (aggregateError) {
        console.error("Legacy co-op route aggregate sync error:", aggregateError);
      }
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

    try {
      const canonicalUpdates = await updateOperationalRouteStatus(db, route_id, status);
      if (canonicalUpdates) {
        if (status === "completed") {
          const canonicalRoutes = await getOperationalRoutes(db, { scheduledDate: null });
          const route = (canonicalRoutes || []).find((item) => item.id === route_id);
          await ensureShoppingDayOpen(db, route?.shopping_date || null);
        }

        return NextResponse.json({ success: true });
      }
    } catch (canonicalError) {
      console.error("Unified operations route status update error:", canonicalError);
    }

    const routeUpdates = { status };
    if (status !== "completed") {
      routeUpdates.completion_type = null;
    } else {
      const { data: stops } = await db
        .from("pickup_route_stops")
        .select("no_inventory, stop_status")
        .eq("route_id", route_id);

      routeUpdates.completion_type = (stops || []).some((stop) => stop.no_inventory || stop.stop_status === "skipped") ? "partial" : "full";
    }

    const { error } = await db.from("pickup_routes").update(routeUpdates).eq("id", route_id);
    if (error) return NextResponse.json({ error: "Failed to update route." }, { status: 500 });

    try {
      await updateCanonicalCoOpRouteStatus(db, route_id, status, { completion_type: routeUpdates.completion_type ?? null });
    } catch (canonicalError) {
      console.error("Canonical co-op route status sync error:", canonicalError);
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
